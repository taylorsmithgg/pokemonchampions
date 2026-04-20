# Offline Sprite Classifier V2

## Goal
Replace the current multi-signal runtime fusion as the primary recognizer with an ahead-of-time trained, bundled classifier that runs locally in-browser or on-device.

The intended production shape is:

1. UI mode detection
2. slot crop extraction
3. optional deterministic shortlist
4. bundled offline-trained classifier
5. global slot assignment
6. local review artifacts

This keeps the browser path fast, deterministic, and easy to inspect.

## Why V2
The current recognition path combines:

- dHash lookup
- masked template matching
- MobileNet embedding nearest-neighbor
- profile histogram/template matching
- screenshot seed matching

Those pieces are individually reasonable, but their scores are not calibrated against each other. That makes the system fragile on noisy screenshots and hard to tune globally.

An ahead-of-time classifier avoids that by learning the actual screenshot domain directly.

## Recommended Model
Primary recommendation:

- `MobileNetV3-Small`

Fallback stronger option:

- `EfficientNet-Lite0`

Do not use as the main bundled recognizer:

- tiny ViT as the first production attempt
- small VLMs like PaliGemma
- runtime screenshot-seed fusion as the primary path

## Label Policy
Use a closed-set label space based on Champions-legal species and forms.

Recommended label granularity:

- species + meaningful form
- separate labels for regional forms
- separate labels for visually distinct special forms that matter in product behavior

Examples:

- `Ninetales-Alola`
- `Arcanine-Hisui`
- `Aegislash-Shield`

Only add shiny as a separate class if the product needs shiny-specific recognition.

## Training Data
The training domain must match runtime inputs.

Include:

- app slot crops
- emulator screenshots
- cropped battle sprites
- compressed screenshots
- blurred screenshots
- rescaled pixel art
- UI-obscured screenshots
- alternate forms and regional variants

Do not rely only on pristine sprite sheets.

## Data Sources
Short term:

- `training/sprite-classifier/config/review-targets.json`
- exported crops from `npm run dataset:export-review-crops`
- current screenshot seeds and validation screenshots

Medium term:

- larger capture set exported from live review sessions
- failure-case crops from `artifacts/detection-review`
- manually verified crops from real streams

## Dataset Format
Recommended directory shape:

```text
training/sprite-classifier/
  config/
    review-targets.json
  dataset/
    review-targets/
      <species>/
        <image>-<side>-slot-<n>.png
      manifest.json
```

Recommended long-term manifest fields:

- `species`
- `sourceImage`
- `sourceType` (`app-screenshot`, `emulator`, `sprite-sheet`, `stream`)
- `crop`
- `isAugmented`
- `compressionLevel`
- `generationStyle`
- `split` (`train`, `val`, `test`)

## Augmentation Policy
Use augmentations that mimic the real UI domain:

- JPEG compression
- blur
- scale up/down
- mild crop shift
- brightness and contrast variation
- color shift
- padding
- partial UI occlusion

Avoid unrealistic augmentations like strong rotation or perspective warp.

## Training Plan
1. Build the initial labeled crop set from review targets.
2. Expand with failure cases from `artifacts/detection-review`.
3. Train a closed-set classifier on sprite-only crops.
4. Export to ONNX.
5. Evaluate with:
   - top-1 accuracy
   - top-3 recall
   - calibration by confidence bucket
   - per-form confusion matrix
6. Integrate as the primary classifier in-browser.

## Runtime V2 Pipeline
### Selection screen
1. detect screen mode
2. detect column layout
3. extract sprite-only slot crops
4. compute optional crop quality score
5. optional hash or template shortlist
6. run classifier on each crop
7. keep top-k per slot
8. solve final assignments with global matching, not greedy per-side selection

### Battle screen
1. detect battle layout
2. crop battler regions
3. classify active battlers
4. optionally smooth over recent frames
5. fuse with battle log only as secondary evidence

## Deterministic Shortlist
Keep deterministic methods, but demote them to fast helpers:

- dHash for exact or near-exact cases
- template matching for obvious clean matches

Use them to:

- short-circuit obvious exact cases
- reduce candidate count
- confirm a high-confidence classifier result

Do not use them as the primary authority on noisy screenshots.

## Assignment Logic
Replace greedy uniqueness with global assignment.

Recommended:

- Hungarian matching
- maximize total slot confidence across one side at a time

Input to assignment:

- top-k predictions per slot
- optional penalties for duplicate species

This is more stable than a per-slot greedy pass.

## Confidence Design
Track three levels of confidence:

- crop confidence
- class confidence
- final decision confidence

This makes lock thresholds easier to reason about than the current mixed heuristic scores.

## Metrics To Gate Production
Use these as the main scorecard:

- top-1 exact accuracy
- top-3 recall
- per-slot exact accuracy
- left-vs-right accuracy
- per-form confusion matrix
- latency by stage
- confidence calibration

For curated screenshot validation, aim for:

- `12/12` exact on every known review image

## Browser Integration
Ship:

- `model.onnx`
- label map
- optional tiny shortlist DB

Use:

- `onnxruntime-web`
- WASM baseline
- WebGPU acceleration when available

Keep OCR out of species identity.

## Migration Plan
### Phase 1
Keep the existing recognizer and add training/eval scaffolding.

Deliverables:

- review-target manifest
- exported labeled crops
- training spec
- offline review gating

### Phase 2
Train the first bundled classifier on screenshot-domain crops.

Deliverables:

- ONNX model
- label map
- benchmark report

### Phase 3
Integrate classifier as the primary recognizer while keeping hash/template as fallback.

Deliverables:

- new classifier inference path
- global assignment
- updated review report with classifier top-k output

### Phase 4
Retire or demote the current weighted fusion if the classifier outperforms it.

## Smallest Reliable Production Shape
The smallest practical version that still feels reliable is:

- mode gating
- slot crop extraction
- dHash shortlist
- `MobileNetV3-Small` classifier
- global assignment
- review artifacts

That should be smaller, faster, and more stable than the current multi-way fusion stack.
