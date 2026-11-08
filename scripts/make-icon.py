from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
image = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((8, 8, 504, 504), radius=116, fill='#237b65')
font = ImageFont.truetype('C:/Windows/Fonts/georgiab.ttf', 392)
draw.text((87, -27), 'd', font=font, fill='#f6f8ed', stroke_width=0)
draw.ellipse((349, 350, 410, 411), fill='#c1cf9e')
image.save(root / 'public/icon.png')
image.save(root / 'public/icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('Created application icons.')
