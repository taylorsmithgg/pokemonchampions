import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('selection screen left column with high threshold', async ({ page }) => {
  const imgPath = path.resolve('image copy.png');
  const imgBuffer = fs.readFileSync(imgPath);
  const dataUrl = 'data:image/png;base64,' + imgBuffer.toString('base64');

  await page.setContent(`
    <html><body style="background:#000;padding:20px;font-family:monospace;color:#fff">
      <h3>Selection Screen — Left Column OCR</h3>
      <img id="ref" style="width:100%;max-width:700px;border:1px solid #333">
      <div id="out"></div>
      <script>
        const img = document.getElementById('ref');
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          const w = c.width, h = c.height;
          const out = document.getElementById('out');

          const showCrop = (label, x0p, y0p, x1p, y1p, threshold) => {
            const x0=Math.round(w*x0p), y0=Math.round(h*y0p);
            const pw=Math.round(w*x1p)-x0, ph=Math.round(h*y1p)-y0;
            const cc = document.createElement('canvas');
            cc.width=pw; cc.height=ph;
            cc.getContext('2d').drawImage(c, x0, y0, pw, ph, 0, 0, pw, ph);
            const pc = document.createElement('canvas');
            pc.width=pw; pc.height=ph;
            const pctx=pc.getContext('2d');
            pctx.drawImage(cc, 0, 0);
            const id=pctx.getImageData(0,0,pw,ph), d=id.data;
            for(let i=0;i<d.length;i+=4){
              const br=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
              d[i]=d[i+1]=d[i+2]= br > threshold ? 0 : 255;
            }
            pctx.putImageData(id,0,0);
            out.innerHTML+='<div style="margin:12px 0"><b>'+label+'</b> threshold='+threshold+'</div>';
            cc.style.border='2px solid #444';cc.style.width=Math.max(300,pw*2)+'px';
            pc.style.border='2px solid #0f0';pc.style.width=Math.max(300,pw*2)+'px';
            out.appendChild(cc);
            out.innerHTML+='<div style="color:#0f0;font-size:11px">Preprocessed:</div>';
            out.appendChild(pc);
          };

          // Full left column at different thresholds
          showCrop('Left Column (threshold 190)', 0.00, 0.07, 0.23, 0.95, 190);
          showCrop('Left Column (threshold 170)', 0.00, 0.07, 0.23, 0.95, 170);
          showCrop('Left Column (threshold 150)', 0.00, 0.07, 0.23, 0.95, 150);

          // Expected species: Floette, Delphox, Primarina, Kingambit
          // (LUCKY GIRL and Monado are nicknames — won't match)

          window.__DONE = true;
        };
        img.src = '${dataUrl}';
      </script>
    </body></html>
  `);

  await page.waitForFunction('window.__DONE', {}, { timeout: 10000 });
  await page.screenshot({ path: 'tests/screenshots/selection-threshold.png', fullPage: true });
  console.log('Check tests/screenshots/selection-threshold.png — names should be visible at right threshold');
});
