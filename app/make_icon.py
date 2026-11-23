# -*- coding: utf-8 -*-
# 生成 VisionCalc 软件图标：深色圆角底 + 相机镜头（同心圆）+ 高光
from PIL import Image, ImageDraw

def make(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size
    # 圆角深蓝底
    d.rounded_rectangle([0, 0, s-1, s-1], radius=int(s*0.22), fill=(24, 60, 100, 255), outline=(120, 170, 220, 255), width=max(1, s//64))
    # 镜头外圈（银色金属圈）
    cx, cy = s//2, s//2
    r_out = int(s*0.36)
    d.ellipse([cx-r_out, cy-r_out, cx+r_out, cy+r_out], fill=(190, 200, 210, 255))
    # 黑色镜筒
    r_barrel = int(s*0.30)
    d.ellipse([cx-r_barrel, cy-r_barrel, cx+r_barrel, cy+r_barrel], fill=(30, 34, 40, 255))
    # 玻璃片（蓝色渐变感用两圈模拟）
    r_glass = int(s*0.20)
    d.ellipse([cx-r_glass, cy-r_glass, cx+r_glass, cy+r_glass], fill=(70, 130, 190, 255))
    r_inner = int(s*0.12)
    d.ellipse([cx-r_inner, cy-r_inner, cx+r_inner, cy+r_inner], fill=(150, 200, 240, 255))
    # 高光
    hr = int(s*0.07)
    d.ellipse([cx-int(s*0.14), cy-int(s*0.16), cx-int(s*0.14)+2*hr, cy-int(s*0.16)+2*hr], fill=(235, 245, 255, 200))
    return img

imgs = {sz: make(sz) for sz in (256, 48, 32, 16)}
imgs[256].save(r"C:\Users\Lenovo\WorkBuddy\2026-11-23-10-41-59\vision-calc\app\icon.ico",
               sizes=[(256,256),(48,48),(32,32),(16,16)])
print("icon.ico saved")
