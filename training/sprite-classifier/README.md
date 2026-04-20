# Sprite Classifier Training

This folder contains the offline training scaffold for the browser-first sprite classifier migration.

## Current Contents
- `config/review-targets.json`
  Hand-labeled screenshot slots used to seed training and evaluation crops.
- `dataset/review-targets/`
  Generated crop export output from the review-target manifest.

## Generate Seed Crops
Run:

```bash
npm run dataset:export-review-crops
```

This exports per-slot PNG crops into:

```text
training/sprite-classifier/dataset/review-targets/
```

and writes:

- `manifest.json`
- `README.md`

## Intended Next Steps
1. Expand the dataset with more real screenshots and failure cases.
2. Split into train/validation/test sets.
3. Train a `MobileNetV3-Small` classifier offline.
4. Export ONNX for browser inference.
5. Compare against `npm run review:detection`.

## Target Runtime Role
This classifier is intended to become the primary species recognizer after crop detection, with hash/template logic reduced to shortlist or confirmation work.
