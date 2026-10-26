"""Generate the original FlowNova desktop icon (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / "apps" / "desktop" / "build"
root.mkdir(parents=True, exist_ok=True)
image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((12, 12, 500, 500), radius=116, fill="#161126")
draw.line([(150, 170), (256, 170), (256, 342), (362, 342)], fill="#aa7dff", width=28)
for x, y, color in [(150, 170, "#b18bff"), (256, 256, "#ffffff"), (362, 342, "#67dbed")]:
    draw.rounded_rectangle((x-47, y-47, x+47, y+47), radius=22, fill=color)
    draw.rounded_rectangle((x-20, y-20, x+20, y+20), radius=8, fill="#161126")
image.save(root / "icon.png")
image.save(root / "icon.ico", sizes=[(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)])
