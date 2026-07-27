#!/usr/bin/env python3
"""Generate VitaHero Play Store + launcher assets using the REAL superhero logo.

Outputs:
- play-store-assets/icon_512.png
- play-store-assets/banner_1024x500.png
- play-store-assets/screenshot_*.png
- android/app/src/main/res/drawable-xxxhdpi/ic_launcher_foreground.png
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import math

ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = ROOT / "presentation" / "vitahero_logo.png"
ICON_PATH = ROOT / "presentation" / "vitahero_logo_icon.png"
FONT_DIR = ROOT / "android/app/src/main/res/font"
OUT_DIR = ROOT / "play-store-assets"
LAUNCHER_DIR = ROOT / "android/app/src/main/res/drawable-xxxhdpi"
OUT_DIR.mkdir(parents=True, exist_ok=True)
LAUNCHER_DIR.mkdir(parents=True, exist_ok=True)

ORANGE = (0xF4, 0x7B, 0x20)
ORANGE_DARK = (0xD9, 0x64, 0x1A)
ORANGE_SOFT = (0xFC, 0xE5, 0xD1)
BLUE = (0x1F, 0xA2, 0xDD)
BLUE_DARK = (0x13, 0x80, 0xB8)
BLUE_SOFT = (0xD6, 0xEF, 0xFA)
YELLOW = (0xFD, 0xB8, 0x13)
PURPLE = (0x8B, 0x5C, 0xF6)
CORAL = (0xFB, 0x71, 0x85)
GOOD = (0x10, 0xB9, 0x81)
WATCH = (0xF5, 0x9E, 0x0B)
ALERT = (0xEF, 0x44, 0x44)
INK = (0x0F, 0x17, 0x2A)
INK_SOFT = (0x47, 0x55, 0x69)
INK_FAINT = (0x94, 0xA3, 0xB8)
CANVAS = (0xFA, 0xFC, 0xFE)
SURFACE = (0xFF, 0xFF, 0xFF)
SURFACE_MUTED = (0xEE, 0xF4, 0xF8)
HAIRLINE = (0xE2, 0xE9, 0xEF)


def load_font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    file = {
        "regular": "host_grotesk_regular.ttf",
        "medium": "host_grotesk_medium.ttf",
        "semibold": "host_grotesk_semibold.ttf",
        "bold": "host_grotesk_bold.ttf",
    }.get(weight, "host_grotesk_regular.ttf")
    return ImageFont.truetype(str(FONT_DIR / file), size)


def text_size(draw, text, font) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def load_logo(path: Path, target: int) -> Image.Image:
    logo = Image.open(path).convert("RGBA")
    logo.thumbnail((target, target), Image.Resampling.LANCZOS)
    return logo


def make_launcher_foreground():
    logo = load_logo(LOGO_PATH, 360)
    size = 432
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - logo.width) // 2
    y = (size - logo.height) // 2
    canvas.paste(logo, (x, y), logo)
    canvas.save(LAUNCHER_DIR / "ic_launcher_foreground.png")
    print("Saved launcher foreground", LAUNCHER_DIR / "ic_launcher_foreground.png")


def make_playstore_icon():
    size = 512
    canvas = Image.new("RGBA", (size, size), SURFACE)
    # Use icon version if it looks better centered, otherwise full logo
    logo = load_logo(ICON_PATH, size - 80)
    x = (size - logo.width) // 2
    y = (size - logo.height) // 2
    canvas.paste(logo, (x, y), logo)
    canvas.save(OUT_DIR / "icon_512.png")
    print("Saved Play Store icon", OUT_DIR / "icon_512.png")


def make_banner():
    w, h = 1024, 500
    canvas = Image.new("RGBA", (w, h), ORANGE)
    draw = ImageDraw.Draw(canvas)

    # diagonal gradient from orange to warm yellow
    for y in range(h):
        t = y / h
        r = int(ORANGE[0] + (YELLOW[0] - ORANGE[0]) * t * 0.5)
        g = int(ORANGE[1] + (YELLOW[1] - ORANGE[1]) * t * 0.5)
        b = int(ORANGE[2] + (YELLOW[2] - ORANGE[2]) * t * 0.5)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # logo on left, larger
    logo = load_logo(LOGO_PATH, 320)
    lx = 80
    ly = h // 2 - logo.height // 2
    canvas.paste(logo, (lx, ly), logo)

    # text on right
    title_font = load_font("bold", 72)
    tag_font = load_font("medium", 32)
    x_text = lx + logo.width + 60
    y_text = h // 2 - 70
    draw.text((x_text, y_text), "VitaHero", fill=SURFACE, font=title_font)
    draw.text((x_text, y_text + 90), "School Health, Simplified", fill=(255, 255, 255, 230), font=tag_font)

    canvas.save(OUT_DIR / "banner_1024x500.png")
    print("Saved banner", OUT_DIR / "banner_1024x500.png")


def phone_canvas() -> tuple[Image.Image, ImageDraw.Draw]:
    img = Image.new("RGBA", (1080, 2400), CANVAS)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 1080, 80], fill=SURFACE)
    status_font = load_font("semibold", 24)
    draw.text((44, 28), "9:41", fill=INK, font=status_font)
    draw.rounded_rectangle([980, 30, 1030, 54], radius=4, outline=INK, width=2)
    draw.rectangle([996, 36, 1024, 48], fill=INK)
    return img, draw


def avatar(draw, x, y, size, letter, color, label=None, sublabel=None):
    draw.ellipse([x, y, x + size, y + size], fill=color)
    font = load_font("bold", size // 2)
    tw, th = text_size(draw, letter, font)
    draw.text((x + (size - tw) // 2, y + (size - th) // 2 - 4), letter, fill=SURFACE, font=font)
    if label:
        lf = load_font("semibold", 26)
        draw.text((x + size + 18, y + 6), label, fill=INK, font=lf)
    if sublabel:
        sf = load_font("regular", 22)
        draw.text((x + size + 18, y + 40), sublabel, fill=INK_SOFT, font=sf)


def progress_ring(draw, cx, cy, radius, progress, color, text):
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], outline=HAIRLINE, width=10)
    if progress > 0:
        draw.arc([cx - radius, cy - radius, cx + radius, cy + radius], start=-90, end=-90 + 360 * progress,
                 fill=color, width=10)
    tf = load_font("bold", 26)
    tw, th = text_size(draw, text, tf)
    draw.text((cx - tw // 2, cy - th // 2 - 2), text, fill=INK, font=tf)


def icon_bubble(draw, x, y, size, color, symbol=None):
    draw.rounded_rectangle([x, y, x + size, y + size], radius=size // 2, fill=color + (0x1F,))
    if symbol:
        font = load_font("semibold", size // 2)
        tw, th = text_size(draw, symbol, font)
        draw.text((x + (size - tw) // 2, y + (size - th) // 2 - 2), symbol, fill=color, font=font)


def quick_action(draw, x, y, w, h, color, icon, label):
    draw.rounded_rectangle([x, y, x + w, y + h], radius=24, fill=SURFACE, outline=HAIRLINE, width=2)
    icon_bubble(draw, x + w // 2 - 22, y + 24, 44, color, icon)
    lf = load_font("semibold", 24)
    tw, th = text_size(draw, label, lf)
    draw.text((x + (w - tw) // 2, y + 80), label, fill=INK, font=lf)


def section_header(draw, x, y, text, action=None):
    lf = load_font("semibold", 28)
    draw.text((x, y), text, fill=INK, font=lf)
    if action:
        af = load_font("medium", 22)
        draw.text((x + 540, y + 4), action, fill=BLUE, font=af)


def make_screenshot_home():
    img, draw = phone_canvas()
    y = 100

    # Top logo + greeting
    title = load_font("regular", 24)
    draw.text((48, y), "Good morning", fill=INK_SOFT, font=title)
    y += 32
    name = load_font("bold", 40)
    draw.text((48, y), "Hi Priya", fill=INK, font=name)
    # notification bell
    draw.rounded_rectangle([940, y - 20, 1010, y + 50], radius=30, fill=SURFACE_MUTED)
    draw.text((958, y - 2), "🔔", fill=INK, font=load_font("regular", 30))
    draw.ellipse([990, y - 26, 1016, y - 2], fill=ALERT)
    badge = load_font("bold", 18)
    draw.text((999, y - 24), "2", fill=SURFACE, font=badge)
    y += 100

    # Hero logo banner with the real superhero logo
    draw.rounded_rectangle([48, y, 1012, y + 220], radius=28, fill=ORANGE)
    for yy in range(y, y + 220):
        t = (yy - y) / 220
        r = int(ORANGE[0] + (YELLOW[0] - ORANGE[0]) * t * 0.4)
        g = int(ORANGE[1] + (YELLOW[1] - ORANGE[1]) * t * 0.4)
        b = int(ORANGE[2] + (YELLOW[2] - ORANGE[2]) * t * 0.4)
        draw.line([(48, yy), (1012, yy)], fill=(r, g, b))
    draw.rounded_rectangle([48, y, 1012, y + 220], radius=28, fill=None)
    logo = load_logo(LOGO_PATH, 170)
    canvas = Image.new("RGBA", (1080, 2400), (0, 0, 0, 0))
    canvas.paste(logo, (80, y + 25), logo)
    img = Image.alpha_composite(img, canvas)
    draw = ImageDraw.Draw(img)
    draw.text((280, y + 50), "VitaHero", fill=SURFACE, font=load_font("bold", 52))
    draw.text((280, y + 120), "Your child's health champion", fill=(255, 255, 255, 230), font=load_font("medium", 28))
    y += 260

    section_header(draw, 48, y, "Your Kids")
    y += 54
    draw.rounded_rectangle([48, y, 640, y + 260], radius=24, fill=SURFACE)
    avatar(draw, 80, y + 32, 60, "A", BLUE, "Aarav", "8 yrs · Grade 3")
    progress_ring(draw, 120, y + 170, 44, 0.92, GOOD, "92%")
    draw.text((188, y + 140), "Health Score", fill=INK_SOFT, font=load_font("regular", 22))
    draw.text((188, y + 170), "Growth on track", fill=GOOD, font=load_font("semibold", 24))
    y += 300

    quick_action(draw, 48, y, 310, 140, ORANGE, "🍽", "Diet Plan")
    quick_action(draw, 380, y, 310, 140, BLUE, "🏥", "Book Visit")
    quick_action(draw, 712, y, 310, 140, YELLOW, "🏅", "Badges")
    y += 180

    section_header(draw, 48, y, "Upcoming Camp", "All Camps")
    y += 54
    for yy in range(y, y + 220):
        t = (yy - y) / 220
        r = int(BLUE[0] + (PURPLE[0] - BLUE[0]) * t)
        g = int(BLUE[1] + (PURPLE[1] - BLUE[1]) * t)
        b = int(BLUE[2] + (PURPLE[2] - BLUE[2]) * t)
        draw.line([(48, yy), (1012, yy)], fill=(r, g, b))
    draw.rounded_rectangle([48, y, 1012, y + 220], radius=24, fill=None)
    pill = load_font("bold", 20)
    draw.rounded_rectangle([76, y + 24, 184, y + 56], radius=16, fill=(255, 255, 255, 50))
    draw.text((92, y + 28), "UPCOMING", fill=SURFACE, font=pill)
    draw.text((76, y + 80), "Dental Check-up Camp", fill=SURFACE, font=load_font("bold", 32))
    draw.text((76, y + 120), "12 Aug 2026 · 9:00 AM", fill=(255, 255, 255, 220), font=load_font("regular", 24))
    draw.rounded_rectangle([76, y + 160, 260, y + 200], radius=12, fill=SURFACE)
    draw.text((104, y + 166), "View Details", fill=BLUE, font=load_font("semibold", 22))
    y += 260

    section_header(draw, 48, y, "Upcoming Appointments")
    y += 60
    draw.rounded_rectangle([48, y, 1012, y + 120], radius=24, fill=SURFACE)
    icon_bubble(draw, 76, y + 30, 48, BLUE, "📅")
    draw.text((142, y + 30), "Dr. Mehta", fill=INK, font=load_font("semibold", 26))
    draw.text((142, y + 62), "Paediatrics · for Aarav", fill=INK_SOFT, font=load_font("regular", 22))
    draw.text((840, y + 30), "14 Aug", fill=BLUE, font=load_font("semibold", 24))
    draw.text((852, y + 62), "10:30 AM", fill=INK_SOFT, font=load_font("regular", 22))

    img.save(OUT_DIR / "screenshot_home.png")
    print("Saved screenshot home", OUT_DIR / "screenshot_home.png")


def make_screenshot_diet():
    img, draw = phone_canvas()
    draw.rectangle([0, 0, 1080, 160], fill=SURFACE)
    draw.text((120, 70), "Aarav — Today's Plan", fill=INK, font=load_font("semibold", 32))
    draw.text((48, 78), "←", fill=INK, font=load_font("bold", 32))
    y = 190

    draw.rounded_rectangle([48, y, 1012, y + 150], radius=24, fill=SURFACE)
    progress_ring(draw, 120, y + 75, 54, 0.66, ORANGE, "2/3")
    draw.text((210, y + 40), "Today's Plan", fill=INK, font=load_font("semibold", 26))
    draw.text((210, y + 76), "840 / 1250 kcal", fill=INK_SOFT, font=load_font("regular", 22))
    draw.text((210, y + 110), "Log all meals to hit the target", fill=ORANGE, font=load_font("semibold", 22))
    y += 180

    for yy in range(y, y + 200):
        t = (yy - y) / 200
        r = int(PURPLE[0] + (BLUE[0] - PURPLE[0]) * t)
        g = int(PURPLE[1] + (BLUE[1] - PURPLE[1]) * t)
        b = int(PURPLE[2] + (BLUE[2] - PURPLE[2]) * t)
        draw.line([(48, yy), (1012, yy)], fill=(r, g, b))
    draw.rounded_rectangle([48, y, 1012, y + 200], radius=24, fill=None)
    draw.rounded_rectangle([76, y + 24, 136, y + 84], radius=30, fill=(255, 255, 255, 50))
    draw.text((88, y + 38), "🧠", fill=SURFACE, font=load_font("regular", 30))
    draw.text((160, y + 34), "AI Diet Coach", fill=SURFACE, font=load_font("bold", 28))
    draw.text((160, y + 70), "Personal tips for Aarav", fill=(255, 255, 255, 220), font=load_font("regular", 22))
    draw.rounded_rectangle([76, y + 130, 1012 - 48, y + 180], radius=14, fill=SURFACE)
    draw.text((360, y + 144), "✨ Generate Tips", fill=PURPLE, font=load_font("semibold", 24))
    y += 230

    draw.text((48, y), "Today's Meals", fill=INK, font=load_font("semibold", 32))
    y += 60
    draw.rounded_rectangle([48, y, 1012, y + 70], radius=16, fill=(0xFF, 0xF1, 0xCC))
    draw.text((430, y + 22), "📷 Recognize Food", fill=INK, font=load_font("semibold", 24))
    y += 100

    meals = [
        ("Breakfast", "Idli + sambar", "320 kcal", True, ORANGE),
        ("Lunch", "Rice, dal, sabzi", "450 kcal", False, SURFACE_MUTED),
        ("Snack", "Fruit bowl", "150 kcal", False, SURFACE_MUTED),
    ]
    for time, name, kcal, eaten, bg in meals:
        draw.rounded_rectangle([48, y, 1012, y + 110], radius=24, fill=bg)
        draw.rounded_rectangle([76, y + 24, 170, y + 52], radius=14, fill=(0xFF, 0xF1, 0xCC) if time == "Breakfast" else (0xE2, 0xE9, 0xEF))
        draw.text((88, y + 26), time, fill=INK, font=load_font("semibold", 20))
        draw.text((190, y + 28), kcal, fill=INK_SOFT, font=load_font("regular", 20))
        draw.text((76, y + 62), name, fill=INK, font=load_font("semibold", 26))
        if eaten:
            draw.ellipse([960, y + 35, 1000, y + 75], fill=ORANGE)
            draw.text((970, y + 42), "✓", fill=SURFACE, font=load_font("bold", 26))
        else:
            draw.ellipse([960, y + 35, 1000, y + 75], outline=SURFACE_MUTED, width=4)
        y += 130

    img.save(OUT_DIR / "screenshot_diet.png")
    print("Saved screenshot diet", OUT_DIR / "screenshot_diet.png")


def make_screenshot_growth():
    img, draw = phone_canvas()
    draw.rectangle([0, 0, 1080, 160], fill=SURFACE)
    draw.text((120, 60), "Clinical Growth Charts", fill=INK, font=load_font("bold", 32))
    draw.text((120, 96), "Growth charts for Aarav", fill=INK_SOFT, font=load_font("regular", 22))
    draw.text((48, 78), "←", fill=INK, font=load_font("bold", 32))
    y = 190

    draw.rounded_rectangle([48, y, 1012, y + 180], radius=24, fill=(0xFC, 0xE5, 0xD1))
    draw.text((76, y + 28), "Current Assessment", fill=INK, font=load_font("semibold", 26))
    rows = [("Height percentile", "72%", "Normal"), ("Weight percentile", "68%", "Normal")]
    for i, (label, val, status) in enumerate(rows):
        yy = y + 76 + i * 44
        draw.text((76, yy), label, fill=INK, font=load_font("regular", 24))
        draw.text((720, yy), val, fill=BLUE, font=load_font("bold", 24))
        draw.text((820, yy), status, fill=INK_SOFT, font=load_font("regular", 22))
    draw.text((76, y + 148), "Reference Standard: WHO 2007", fill=INK_SOFT, font=load_font("regular", 20))
    y += 220

    draw.rounded_rectangle([48, y, 180, y + 48], radius=24, fill=BLUE_SOFT)
    draw.text((72, y + 12), "Height Chart", fill=BLUE, font=load_font("bold", 22))
    draw.rounded_rectangle([200, y, 370, y + 48], radius=24, fill=SURFACE_MUTED)
    draw.text((224, y + 12), "Weight Chart", fill=INK_SOFT, font=load_font("medium", 22))
    y += 80

    draw.rounded_rectangle([48, y, 1012, y + 580], radius=24, fill=SURFACE)
    draw.text((76, y + 28), "Your child: 128.4 cm", fill=ORANGE, font=load_font("semibold", 26))
    legend = [((0xF5, 0x9E, 0x0B), "P97"), ((0x1F, 0xA2, 0xDD), "P85"), ((0xF4, 0x7B, 0x20), "P50"), ((0x94, 0xA3, 0xB8), "P3")]
    lx = 76
    for col, lab in legend:
        draw.ellipse([lx, y + 70, lx + 14, y + 84], fill=col)
        draw.text((lx + 22, y + 68), lab, fill=INK_SOFT, font=load_font("regular", 20))
        lx += 90

    chart_x, chart_y = 120, y + 140
    chart_w, chart_h = 880, 320
    for i in range(5):
        yy = chart_y + chart_h * i / 4
        draw.line([(chart_x, int(yy)), (chart_x + chart_w, int(yy))], fill=HAIRLINE, width=1)
    for idx, color in enumerate([(0x94, 0xA3, 0xB8), (0x67, 0xC1, 0xE8), (0xF4, 0x7B, 0x20), (0xA3, 0xD4, 0xF2), (0xFD, 0xB8, 0x13)]):
        points = []
        base = 0.3 + 0.05 * (3 - idx)
        for i in range(20):
            xx = chart_x + chart_w * i / 19
            yy = chart_y + chart_h * (base + 0.15 * math.sin(i / 3.0 + idx))
            points.append((xx, yy))
        for i in range(len(points) - 1):
            width = 3 if idx == 2 else 2
            draw.line([points[i], points[i + 1]], fill=color, width=width)
    cx = chart_x + chart_w * 0.55
    cy = chart_y + chart_h * 0.45
    draw.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=ORANGE)
    draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=SURFACE)
    for lab, px in [("2y", 120), ("10y", 560), ("18y", 980)]:
        draw.text((px, y + 480), lab, fill=INK_SOFT, font=load_font("regular", 22))

    draw.text((48, y + 620), "Charts are for tracking, not a medical diagnosis.", fill=INK_SOFT, font=load_font("regular", 22))
    img.save(OUT_DIR / "screenshot_growth.png")
    print("Saved screenshot growth", OUT_DIR / "screenshot_growth.png")


def make_screenshot_report():
    img, draw = phone_canvas()
    draw.rectangle([0, 0, 1080, 160], fill=SURFACE)
    draw.text((120, 70), "Aarav", fill=INK, font=load_font("bold", 32))
    draw.text((120, 106), "8y · Male · Grade 3", fill=INK_SOFT, font=load_font("regular", 22))
    draw.text((48, 78), "←", fill=INK, font=load_font("bold", 32))
    y = 190

    draw.rounded_rectangle([48, y, 1012, y + 110], radius=24, fill=SURFACE)
    icon_bubble(draw, 76, y + 26, 44, BLUE, "🏥")
    draw.text((140, y + 28), "Parent: Rahul Sharma", fill=INK, font=load_font("semibold", 24))
    draw.text((140, y + 62), "Phone: +91 98765 43210", fill=INK_SOFT, font=load_font("regular", 22))
    y += 140

    sections = [
        ("Vitals & Anthropometry", [("Height (cm)", "128.4"), ("Weight (kg)", "26.2"), ("BMI", "15.9")]),
        ("Dental Check", [("Overall Dental Status", "GOOD"), ("Oral Hygiene", "Good"), ("Caries Present", "No")]),
        ("Vision Screening", [("Overall Vision Status", "GOOD"), ("Right Eye (6/x)", "6/6"), ("Left Eye (6/x)", "6/6")]),
    ]
    for title, rows in sections:
        draw.rounded_rectangle([48, y, 1012, y + 60 + len(rows) * 52], radius=24, fill=SURFACE)
        draw.text((76, y + 18), title, fill=INK, font=load_font("semibold", 26))
        draw.text((960, y + 18), "⌄", fill=ORANGE, font=load_font("bold", 26))
        for i, (label, val) in enumerate(rows):
            yy = y + 62 + i * 52
            draw.text((76, yy), label, fill=INK_SOFT, font=load_font("regular", 22))
            draw.text((820, yy), val, fill=INK, font=load_font("semibold", 22))
        y += 90 + len(rows) * 52

    for yy in range(y, y + 80):
        t = (yy - y) / 80
        r = int(ORANGE[0] + (BLUE[0] - ORANGE[0]) * t)
        g = int(ORANGE[1] + (BLUE[1] - ORANGE[1]) * t)
        b = int(ORANGE[2] + (BLUE[2] - ORANGE[2]) * t)
        draw.line([(48, yy), (1012, yy)], fill=(r, g, b))
    draw.rounded_rectangle([48, y, 1012, y + 80], radius=16, fill=None)
    draw.text((430, y + 28), "Save Health Checkup", fill=SURFACE, font=load_font("semibold", 28))

    img.save(OUT_DIR / "screenshot_report.png")
    print("Saved screenshot report", OUT_DIR / "screenshot_report.png")


if __name__ == "__main__":
    make_launcher_foreground()
    make_playstore_icon()
    make_banner()
    make_screenshot_home()
    make_screenshot_diet()
    make_screenshot_growth()
    make_screenshot_report()
