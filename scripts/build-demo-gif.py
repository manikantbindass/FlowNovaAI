"""Encode a step sequence from real application captures; does not fabricate UI states."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
shots=root/'docs/assets/screenshots'
names=['editor','published','run-input','execution','history','analytics','overview']
frames=[Image.open(shots/(name+'.png')).convert('P',palette=Image.Palette.ADAPTIVE,colors=128) for name in names]
target=root/'docs/assets/workflow-demo.gif'
frames[0].save(target,save_all=True,append_images=frames[1:],duration=[1800,1600,1800,3500,1800,1800,2000],loop=0,optimize=True,disposal=2)
with Image.open(target) as result:
 assert result.n_frames==len(names)
 print(f'Encoded {result.n_frames} real screenshot states: {target} ({target.stat().st_size} bytes)')
