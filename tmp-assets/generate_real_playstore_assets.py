#!/usr/bin/env python3
"""Generate Play Store assets that match the real VitaHero Android app design.

Uses the actual project fonts, logo, and color tokens from the Compose theme.
Renders faithful screen mockups at required Play Console sizes.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "play-store-assets")
FONT_DIR = os.path.join(ROOT, "android", "app", "src", "main", "res", "font")
LOGO_PATH = os.path.join(ROOT, "presentation", "vitahero_logo.png")

os.makedirs(OUT_DIR, exist_ok=True)

# ───────────────────────── Brand colors (from Color.kt) ─────────────────────────
HERO_ORANGE = "#F47B20"
HERO_ORANGE_DARK = "#D9641A"
HERO_ORANGE_SOFT = "#FCE5D1"
HERO_BLUE = "#1FA2DD"
HERO_BLUE_DARK = "#1380B8"
HERO_BLUE_SOFT = "#D6EFFA"
HERO_YELLOW = "#FDB813"
HERO_YELLOW_SOFT = "#FFF1CC"
HERO_PURPLE = "#8B5CF6"
HERO_CORAL = "#FB7185"
INK = "#0F172A"
INK_SOFT = "#475569"
INK_FAINT = "#94A3B8"
CANVAS = "#FAFCFE"
SURFACE_WHITE = "#FFFFFF"
SURFACE_MUTED = "#EEF4F8"
HAIR_LINE = "#E2E9EF"
FLAG_GOOD = "#10B981"
FLAG_WATCH = "#F59E0B"
FLAG_ALERT = "#EF4444"


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


# Pre-convert
for name, val in list(globals().items()):
    if isinstance(val, str) and val.startswith("#"):
        globals()[name + "_RGB"] = hex_to_rgb(val)

# ───────────────────────── Fonts ─────────────────────────
def load_font(weight, size):
    mapping = {
        "regular": "host_grotesk_regular.ttf",
        "medium": "host_grotesk_medium.ttf",
        "semibold": "host_grotesk_semibold.ttf",
        "bold": "host_grotesk_bold.ttf",
    }
    path = os.path.join(FONT_DIR, mapping[weight])
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def get_font(size, weight="regular"):
    return load_font(weight, size)


# ───────────────────────── Helpers ─────────────────────────
def rounded_rect(draw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def gradient(size, c1, c2, direction="vertical"):
    base = Image.new("RGB", size, c1)
    draw = ImageDraw.Draw(base)
    w, h = size
    if direction == "vertical":
        for y in range(h):
            ratio = y / h
            r = int(c1[0] + (c2[0] - c1[0]) * ratio)
            g = int(c1[1] + (c2[1] - c1[1]) * ratio)
            b = int(c1[2] + (c2[2] - c1[2]) * ratio)
            draw.line([(0, y), (w, y)], fill=(r, g, b))
    else:
        for x in range(w):
            ratio = x / w
            r = int(c1[0] + (c2[0] - c1[0]) * ratio)
            g = int(c1[1] + (c2[1] - c1[1]) * ratio)
            b = int(c1[2] + (c2[2] - c1[2]) * ratio)
            draw.line([(x, 0), (x, h)], fill=(r, g, b))
    return base


def draw_text(draw, text, pos, font, fill, anchor="lt"):
    draw.text(pos, text, font=font, fill=fill, anchor=anchor)


def text_size(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_avatar(draw, xy, size, letter, color):
    x, y = xy
    # gradient circle
    for r in range(size // 2, -1, -1):
        ratio = r / (size // 2)
        r_col = int(color[0] * (1 - ratio * 0.3))
        g_col = int(color[1] * (1 - ratio * 0.3))
        b_col = int(color[2] * (1 - ratio * 0.3))
        draw.ellipse([x + size // 2 - r, y + size // 2 - r,
                      x + size // 2 + r, y + size // 2 + r], fill=(r_col, g_col, b_col))
    font = get_font(size // 2, "bold")
    draw_text(draw, letter, (x + size // 2, y + size // 2), font, SURFACE_WHITE_RGB, "mm")


def draw_icon_bubble(draw, xy, size, icon_text, tint, bg_alpha=0.14):
    x, y = xy
    bg = tuple(int(c * (1 - bg_alpha) + 255 * bg_alpha) for c in tint)
    draw.ellipse([x, y, x + size, y + size], fill=bg)
    font = get_font(int(size * 0.45), "regular")
    draw_text(draw, icon_text, (x + size // 2, y + size // 2), font, tint, "mm")


def draw_progress_ring(draw, xy, size, progress, color, track, center_text=""):
    x, y = xy
    cx, cy = x + size // 2, y + size // 2
    r = size // 2 - 8
    # track
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=track, width=8)
    # progress arc
    if progress > 0:
        steps = int(360 * progress)
        for i in range(steps):
            rad = math.radians(i - 90)
            x1 = cx + r * math.cos(rad)
            y1 = cy + r * math.sin(rad)
            rad2 = math.radians(i + 1 - 90)
            x2 = cx + r * math.cos(rad2)
            y2 = cy + r * math.sin(rad2)
            draw.line([(x1, y1), (x2, y2)], fill=color, width=8)
    if center_text:
        font = get_font(size // 4, "bold")
        draw_text(draw, center_text, (cx, cy), font, INK_RGB, "mm")


def draw_card_bg(draw, xy, wh, radius=24, fill=SURFACE_WHITE_RGB, border=HAIR_LINE_RGB):
    x, y, w, h = xy[0], xy[1], wh[0], wh[1]
    rounded_rect(draw, [x, y, x + w, y + h], radius, fill, border, 1)


def status_bar(draw, w, time_text="9:41"):
    sb_h = 40
    font = get_font(14, "semibold")
    draw_text(draw, time_text, (24, 16), font, INK_RGB, "lm")
    # battery / wifi simplified
    batt_w = 22
    batt_h = 11
    rounded_rect(draw, [w - 24 - batt_w, 16 - batt_h // 2, w - 24, 16 + batt_h // 2], 2, None, INK_RGB, 1)
    draw.rectangle([w - 24 - batt_w + 2, 16 - batt_h // 2 + 2,
                    w - 24 - 2, 16 + batt_h // 2 - 2], fill=INK_RGB)
    # battery nub
    draw.rectangle([w - 22, 16 - 3, w - 20, 16 + 3], fill=INK_RGB)


def section_header(draw, x, y, w, title, action=None):
    font_title = get_font(22, "bold")
    draw_text(draw, title, (x, y), font_title, INK_RGB, "lt")
    if action:
        font_action = get_font(13, "semibold")
        tw, th = text_size(draw, action, font_action)
        rounded_rect(draw, [x + w - tw - 20, y - 4, x + w, y + th + 4], 8,
                     HERO_ORANGE_SOFT_RGB, None, 0)
        draw_text(draw, action, (x + w - 10, y + th // 2), font_action, HERO_ORANGE_DARK_RGB, "rm")
    return y + 32


# ───────────────────────── Screens ─────────────────────────
def render_home(w, h, logo):
    img = Image.new("RGB", (w, h), CANVAS_RGB)
    draw = ImageDraw.Draw(img)
    status_bar(draw, w, "9:41")

    y = 60
    # greeting row
    font_greet = get_font(15, "regular")
    font_name = get_font(26, "bold")
    draw_text(draw, "Good morning", (24, y), font_greet, INK_SOFT_RGB, "lt")
    y += 22
    draw_text(draw, "Hi, Priya", (24, y), font_name, INK_RGB, "lt")
    # notification bell
    draw_icon_bubble(draw, (w - 70, 66), 46, "🔔", INK_RGB, 0.08)
    # badge
    draw.ellipse([w - 30, 66, w - 18, 78], fill=FLAG_ALERT_RGB)
    font_badge = get_font(10, "bold")
    draw_text(draw, "2", (w - 24, 72), font_badge, SURFACE_WHITE_RGB, "mm")

    y += 55
    # Your kids section
    y = section_header(draw, 24, y, w - 48, "Your kids")
    y += 10

    # Kid cards (two)
    card_w = w - 90
    card_h = 170
    x_card = 24
    colors = [HERO_ORANGE_RGB, HERO_BLUE_RGB]
    names = ["Aarav", "Ananya"]
    grades = ["8 yrs · Grade 3", "6 yrs · Grade 1"]
    scores = [92, 88]
    for i in range(2):
        cx = x_card + i * (card_w + 14)
        draw_card_bg(draw, (cx, y), (card_w, card_h), 24, SURFACE_WHITE_RGB)
        draw_avatar(draw, (cx + 18, y + 18), 44, names[i][0], colors[i])
        font_name = get_font(17, "semibold")
        draw_text(draw, names[i], (cx + 70, y + 22), font_name, INK_RGB, "lt")
        font_sub = get_font(13, "regular")
        draw_text(draw, grades[i], (cx + 70, y + 44), font_sub, INK_SOFT_RGB, "lt")
        draw_progress_ring(draw, (cx + 18, y + 82), 58, scores[i] / 100, colors[i], SURFACE_MUTED_RGB,
                           f"{scores[i]}%")
        font_label = get_font(12, "regular")
        draw_text(draw, "Health score", (cx + 86, y + 100), font_label, INK_SOFT_RGB, "lt")
        font_status = get_font(14, "semibold")
        status_text = "Growth on track" if scores[i] >= 85 else "Doing well"
        draw_text(draw, status_text, (cx + 86, y + 118), font_status, colors[i], "lt")

    y += card_h + 28
    # quick actions
    y = section_header(draw, 24, y, w - 48, "Quick actions")
    y += 12
    qa = [("Diet plan", "🍽", HERO_ORANGE_RGB), ("Book visit", "🏥", HERO_BLUE_RGB), ("Badges", "🏆", HERO_YELLOW_RGB)]
    qw = (w - 48 - 24) // 3
    for i, (label, icon, col) in enumerate(qa):
        cx = 24 + i * (qw + 12)
        draw_card_bg(draw, (cx, y), (qw, 100), 20, SURFACE_WHITE_RGB)
        draw_icon_bubble(draw, (cx + qw // 2 - 22, y + 16), 44, icon, col, 0.14)
        font = get_font(13, "semibold")
        draw_text(draw, label, (cx + qw // 2, y + 72), font, INK_RGB, "mm")

    y += 120
    # Upcoming camp banner
    y = section_header(draw, 24, y, w - 48, "Upcoming camp", "All camps")
    y += 12
    bh = 150
    # gradient banner
    banner = gradient((w - 48, bh), HERO_BLUE_RGB, HERO_PURPLE_RGB, "diagonal")
    img.paste(banner, (24, y))
    drawb = ImageDraw.Draw(img)
    rounded_rect(drawb, [24, y, 24 + w - 48, y + bh], 24, None, None, 0)
    font_tag = get_font(11, "bold")
    drawb.text((44, y + 18), "UPCOMING", font=font_tag, fill=SURFACE_WHITE_RGB)
    font_title = get_font(20, "bold")
    drawb.text((44, y + 44), "Summer Health Camp", font=font_title, fill=SURFACE_WHITE_RGB)
    font_meta = get_font(14, "regular")
    drawb.text((44, y + 70), "24 Aug · 9:00 AM", font=font_meta, fill=SURFACE_WHITE_RGB)
    # cta button
    rounded_rect(drawb, [44, y + 98, 170, y + 130], 12, SURFACE_WHITE_RGB)
    font_cta = get_font(13, "semibold")
    drawb.text((48, y + 105), "View details", font=font_cta, fill=HERO_BLUE_RGB)

    return img


def render_kid_detail(w, h, logo):
    img = Image.new("RGB", (w, h), CANVAS_RGB)
    draw = ImageDraw.Draw(img)
    status_bar(draw, w, "9:41")

    y = 60
    # header gradient
    header_h = 320
    head_grad = gradient((w, header_h), HERO_ORANGE_SOFT_RGB, CANVAS_RGB, "vertical")
    img.paste(head_grad, (0, y))

    # back arrow
    draw_icon_bubble(draw, (20, y + 12), 44, "←", INK_RGB, 0.08)
    # share report pill
    font_share = get_font(12, "semibold")
    sw, sh = text_size(draw, "Share Report", font_share)
    rounded_rect(draw, [w - 24 - sw - 28, y + 14, w - 24, y + 14 + 32], 12, SURFACE_WHITE_RGB)
    draw_text(draw, "Share Report", (w - 24 - sw - 14, y + 14 + 16), font_share, HERO_ORANGE_RGB, "lm")

    # avatar center
    draw_avatar(draw, (w // 2 - 42, y + 70), 84, "A", HERO_ORANGE_RGB)
    font_name = get_font(26, "bold")
    draw_text(draw, "Aarav", (w // 2, y + 162), font_name, INK_RGB, "mm")
    font_sub = get_font(15, "regular")
    draw_text(draw, "8 yrs · M · Little Scholars", (w // 2, y + 188), font_sub, INK_SOFT_RGB, "mm")
    # stats
    stat_w = 100
    stat_h = 56
    for i, (label, value) in enumerate([("Height", "128 cm"), ("Weight", "28 kg")]):
        sx = w // 2 - 110 + i * 120
        rounded_rect(draw, [sx, y + 212, sx + stat_w, y + 212 + stat_h], 16, SURFACE_WHITE_RGB)
        font_val = get_font(17, "bold")
        draw_text(draw, value, (sx + stat_w // 2, y + 212 + 16), font_val, INK_RGB, "mm")
        font_lbl = get_font(11, "regular")
        draw_text(draw, label, (sx + stat_w // 2, y + 212 + 40), font_lbl, INK_SOFT_RGB, "mm")

    y += header_h + 10
    # log measurements button
    rounded_rect(draw, [24, y, w - 24, y + 48], 16, HERO_ORANGE_SOFT_RGB)
    font_btn = get_font(14, "semibold")
    draw_text(draw, "+  Log measurements", (w // 2, y + 24), font_btn, HERO_ORANGE_RGB, "mm")

    y += 66
    # tabs
    tab_labels = ["Growth", "Dental", "Eye", "Nutrition"]
    tab_w = (w - 48) // 4
    rounded_rect(draw, [24, y, w - 24, y + 44], 16, SURFACE_MUTED_RGB)
    for i, label in enumerate(tab_labels):
        tx = 24 + i * tab_w
        if i == 0:
            rounded_rect(draw, [tx + 4, y + 4, tx + tab_w - 4, y + 40], 12, SURFACE_WHITE_RGB)
            col = HERO_ORANGE_RGB
            wt = "bold"
        else:
            col = INK_SOFT_RGB
            wt = "medium"
        font = get_font(13, wt)
        draw_text(draw, label, (tx + tab_w // 2, y + 22), font, col, "mm")

    y += 60
    # activity card
    card_h = 80
    draw_card_bg(draw, (24, y), (w - 48, card_h), 24, SURFACE_WHITE_RGB)
    draw_icon_bubble(draw, (40, y + 18), 44, "⌚", HERO_YELLOW_RGB, 0.14)
    font_title = get_font(15, "semibold")
    draw_text(draw, "Activity data", (92, y + 22), font_title, INK_RGB, "lt")
    font_sub = get_font(13, "regular")
    draw_text(draw, "6,240 steps today · 48 active min", (92, y + 44), font_sub, INK_SOFT_RGB, "lt")
    draw_icon_bubble(draw, (w - 80, y + 18), 44, "↻", HERO_ORANGE_RGB, 0.14)

    y += card_h + 14
    # growth chart card
    chart_h = 260
    draw_card_bg(draw, (24, y), (w - 48, chart_h), 24, SURFACE_WHITE_RGB)
    font_title = get_font(17, "semibold")
    draw_text(draw, "Height trend", (42, y + 18), font_title, INK_RGB, "lt")
    # flag chip
    rounded_rect(draw, [w - 110, y + 16, w - 40, y + 40], 50, (209, 250, 235))
    font_chip = get_font(11, "semibold")
    draw_text(draw, "On track", (w - 75, y + 28), font_chip, FLAG_GOOD_RGB, "mm")
    # chart
    chart_y = y + 60
    chart_h_inner = 140
    chart_w = w - 96
    # grid lines
    for g in range(4):
        gy = chart_y + g * chart_h_inner // 3
        draw.line([(42, gy), (42 + chart_w, gy)], fill=SURFACE_MUTED_RGB, width=2)
    # line area
    points = [(42, chart_y + 110), (42 + chart_w // 4, chart_y + 80),
              (42 + chart_w // 2, chart_y + 55), (42 + 3 * chart_w // 4, chart_y + 40),
              (42 + chart_w, chart_y + 30)]
    # fill area
    poly = [(42, chart_y + chart_h_inner)] + points + [(42 + chart_w, chart_y + chart_h_inner)]
    # gradient fill via overlay polygon
    draw.polygon(poly, fill=(244, 123, 32, 40))
    # line
    for i in range(len(points) - 1):
        draw.line([points[i], points[i+1]], fill=HERO_ORANGE_RGB, width=6)
    for p in points:
        draw.ellipse([p[0]-8, p[1]-8, p[0]+8, p[1]+8], fill=SURFACE_WHITE_RGB, outline=HERO_ORANGE_RGB, width=4)
    # labels
    font_lbl = get_font(12, "regular")
    labels = ["Jan", "Apr", "Jul", "Oct", "Jan"]
    for i, l in enumerate(labels):
        lx = 42 + i * chart_w // 4
        draw_text(draw, l, (lx, chart_y + chart_h_inner + 16), font_lbl, INK_SOFT_RGB, "mm")

    return img


def render_diet(w, h, logo):
    img = Image.new("RGB", (w, h), CANVAS_RGB)
    draw = ImageDraw.Draw(img)
    status_bar(draw, w, "9:41")

    y = 60
    # top bar
    draw_icon_bubble(draw, (20, y), 44, "←", INK_RGB, 0.08)
    font_title = get_font(19, "bold")
    draw_text(draw, "Aarav — Today's plan", (w // 2, y + 22), font_title, INK_RGB, "mm")

    y += 70
    # summary card
    card_h = 120
    draw_card_bg(draw, (24, y), (w - 48, card_h), 24, SURFACE_WHITE_RGB)
    draw_progress_ring(draw, (44, y + 24), 72, 3 / 5, HERO_ORANGE_RGB, SURFACE_MUTED_RGB, "3/5")
    font_title = get_font(17, "semibold")
    draw_text(draw, "Today's plan", (132, y + 28), font_title, INK_RGB, "lt")
    font_sub = get_font(14, "regular")
    draw_text(draw, "850 / 1,400 kcal", (132, y + 52), font_sub, INK_SOFT_RGB, "lt")
    font_hint = get_font(13, "semibold")
    draw_text(draw, "Log all meals to reach today's goal", (132, y + 78), font_hint, HERO_ORANGE_RGB, "lt")

    y += card_h + 16
    # AI coach card
    ai_h = 170
    ai_grad = gradient((w - 48, ai_h), HERO_PURPLE_RGB, HERO_BLUE_RGB, "diagonal")
    img.paste(ai_grad, (24, y))
    rounded_rect(draw, [24, y, 24 + w - 48, y + ai_h], 24, None, None, 0)
    draw_icon_bubble(draw, (44, y + 20), 40, "🧠", SURFACE_WHITE_RGB, 0.2)
    font_title = get_font(17, "bold")
    draw_text(draw, "AI Diet Coach", (92, y + 26), font_title, SURFACE_WHITE_RGB, "lt")
    font_sub = get_font(13, "regular")
    draw_text(draw, "Personal tips for Aarav", (92, y + 50), font_sub, SURFACE_WHITE_RGB)
    # white cta
    rounded_rect(draw, [44, y + 110, w - 44, y + 146], 14, SURFACE_WHITE_RGB)
    font_cta = get_font(14, "semibold")
    draw_text(draw, "✨ Generate tips", (w // 2, y + 128), font_cta, HERO_PURPLE_RGB, "mm")

    y += ai_h + 20
    font_sec = get_font(22, "bold")
    draw_text(draw, "Today's meals", (24, y), font_sec, INK_RGB, "lt")
    y += 36

    meals = [
        ("Breakfast", "Oats porridge with banana", 320, True),
        ("Mid-morning", "Mixed nuts & milk", 180, True),
        ("Lunch", "Roti, dal & vegetables", 450, False),
        ("Snack", "Fruit yogurt", 140, False),
        ("Dinner", "Grilled chicken & rice", 350, False),
    ]
    for time, name, kcal, eaten in meals:
        mh = 80
        bg = HERO_ORANGE_SOFT_RGB if eaten else SURFACE_WHITE_RGB
        draw_card_bg(draw, (24, y), (w - 48, mh), 18, bg)
        # time chip
        rounded_rect(draw, [42, y + 14, 42 + 70, y + 34], 50, HERO_YELLOW_SOFT_RGB)
        font_chip = get_font(11, "semibold")
        draw_text(draw, time, (77, y + 24), font_chip, (178, 109, 0), "mm")
        font_kcal = get_font(11, "regular")
        draw_text(draw, f"{kcal} kcal", (122, y + 24), font_kcal, INK_SOFT_RGB, "lm")
        font_name = get_font(15, "semibold")
        col = INK_SOFT_RGB if eaten else INK_RGB
        draw_text(draw, name, (42, y + 48), font_name, col, "lt")
        # check circle
        check_col = HERO_ORANGE_RGB if eaten else SURFACE_MUTED_RGB
        check_fill = HERO_ORANGE_RGB if eaten else SURFACE_MUTED_RGB
        draw.ellipse([w - 72, y + 24, w - 40, y + 56], fill=check_fill)
        if eaten:
            font_check = get_font(18, "bold")
            draw_text(draw, "✓", (w - 56, y + 40), font_check, SURFACE_WHITE_RGB, "mm")
        y += mh + 10

    return img


def render_camps(w, h, logo):
    img = Image.new("RGB", (w, h), CANVAS_RGB)
    draw = ImageDraw.Draw(img)
    status_bar(draw, w, "9:41")

    y = 60
    font_title = get_font(26, "bold")
    draw_text(draw, "School camps", (24, y), font_title, INK_RGB, "lt")
    font_sub = get_font(15, "regular")
    draw_text(draw, "Health screenings & follow-ups", (24, y + 34), font_sub, INK_SOFT_RGB, "lt")

    y += 80
    # link school card
    draw_card_bg(draw, (24, y), (w - 48, 80), 20, SURFACE_WHITE_RGB)
    draw_icon_bubble(draw, (42, y + 18), 44, "🏫", HERO_BLUE_RGB, 0.14)
    font_title = get_font(15, "semibold")
    draw_text(draw, "Link school partners", (94, y + 22), font_title, INK_RGB, "lt")
    font_sub = get_font(13, "regular")
    draw_text(draw, "Get reports from school camps", (94, y + 44), font_sub, INK_SOFT_RGB, "lt")
    y += 96

    font_sec = get_font(22, "bold")
    draw_text(draw, "Upcoming", (24, y), font_sec, INK_RGB, "lt")
    y += 36
    # upcoming camp card
    ch = 220
    draw_card_bg(draw, (24, y), (w - 48, ch), 24, SURFACE_WHITE_RGB)
    draw_icon_bubble(draw, (44, y + 18), 44, "📅", HERO_BLUE_RGB, 0.14)
    font_tag = get_font(11, "semibold")
    rounded_rect(draw, [w - 110, y + 20, w - 40, y + 42], 50, HERO_BLUE_SOFT_RGB)
    draw_text(draw, "Upcoming", (w - 75, y + 31), font_tag, HERO_BLUE_DARK_RGB, "mm")
    font_title = get_font(17, "semibold")
    draw_text(draw, "Summer Health Camp", (94, y + 22), font_title, INK_RGB, "lt")
    font_sch = get_font(13, "regular")
    draw_text(draw, "Little Scholars", (94, y + 46), font_sch, INK_SOFT_RGB, "lt")
    # time
    draw_text(draw, "🕐 24 Aug · 9:00 AM", (44, y + 84), font_sch, INK_RGB, "lt")
    # checks
    checks = ["Vision", "Dental", "Growth", "BMI"]
    cx = 44
    for c in checks:
        cw = text_size(draw, c, font_tag)[0] + 20
        rounded_rect(draw, [cx, y + 120, cx + cw, y + 142], 50, SURFACE_MUTED_RGB)
        draw_text(draw, c, (cx + cw // 2, y + 131), font_tag, INK_SOFT_RGB, "mm")
        cx += cw + 8
    # button
    rounded_rect(draw, [44, y + 164, w - 44, y + 198], 14, SURFACE_MUTED_RGB)
    draw_text(draw, "Add to reminders", (w // 2, y + 181), font_tag, INK_RGB, "mm")

    y += ch + 20
    font_sec2 = get_font(22, "bold")
    draw_text(draw, "Past camps", (24, y), font_sec2, INK_RGB, "lt")
    y += 36
    # past camp card
    ch2 = 220
    draw_card_bg(draw, (24, y), (w - 48, ch2), 24, SURFACE_WHITE_RGB)
    draw_icon_bubble(draw, (44, y + 18), 44, "✓", HERO_ORANGE_RGB, 0.14)
    rounded_rect(draw, [w - 110, y + 20, w - 40, y + 42], 50, HERO_ORANGE_SOFT_RGB)
    draw_text(draw, "Completed", (w - 75, y + 31), font_tag, HERO_ORANGE_DARK_RGB, "mm")
    draw_text(draw, "Winter Screening 2024", (94, y + 22), font_title, INK_RGB, "lt")
    draw_text(draw, "Little Scholars", (94, y + 46), font_sch, INK_SOFT_RGB, "lt")
    draw_text(draw, "🕐 15 Dec 2024 · 10:00 AM", (44, y + 84), font_sch, INK_RGB, "lt")
    for c in checks:
        cw = text_size(draw, c, font_tag)[0] + 20
        rounded_rect(draw, [cx, y + 120, cx + cw, y + 142], 50, SURFACE_MUTED_RGB)
        draw_text(draw, c, (cx + cw // 2, y + 131), font_tag, INK_SOFT_RGB, "mm")
        cx += cw + 8
    # summary box
    rounded_rect(draw, [44, y + 154, w - 44, y + 184], 12, HERO_ORANGE_SOFT_RGB)
    draw_text(draw, "Overall: On track — no referrals needed", (w // 2, y + 169), font_tag, HERO_ORANGE_DARK_RGB, "mm")

    return img


# ───────────────────────── Feature graphic ─────────────────────────
def render_feature_graphic(w, h, logo):
    img = Image.new("RGB", (w, h), CANVAS_RGB)
    draw = ImageDraw.Draw(img)
    # soft gradient background blobs
    for cx, cy, r, col in [(120, 120, 180, HERO_ORANGE_SOFT_RGB), (900, 350, 200, HERO_BLUE_SOFT_RGB), (700, 80, 140, (237, 233, 254))]:
        for i in range(r, 0, -1):
            alpha = max(0, int(180 * (1 - i / r)))
            col_fade = tuple(int(c * (1 - alpha / 255) + 255 * (alpha / 255)) for c in col)
            draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=col_fade)

    # logo on left
    logo_size = 280
    logo_resized = logo.resize((logo_size, int(logo.height * logo_size / logo.width)), Image.LANCZOS)
    lx = 70
    ly = h // 2 - logo_resized.height // 2
    img.paste(logo_resized, (lx, ly), logo_resized if logo_resized.mode == "RGBA" else None)

    # text on right
    tx = lx + logo_size + 60
    font_tag = get_font(16, "bold")
    draw_text(draw, "CHILD HEALTH & WELLNESS", (tx, 140), font_tag, HERO_ORANGE_RGB, "lt")
    font_title = get_font(44, "bold")
    draw_text(draw, "Track, nourish &", (tx, 180), font_title, INK_RGB, "lt")
    draw_text(draw, "grow healthy heroes", (tx, 230), font_title, INK_RGB, "lt")
    font_sub = get_font(20, "regular")
    draw_text(draw, "Diet plans, growth charts, school camps &", (tx, 290), font_sub, INK_SOFT_RGB, "lt")
    draw_text(draw, "doctor bookings — all in one place.", (tx, 318), font_sub, INK_SOFT_RGB, "lt")

    # Google Play badge style
    rounded_rect(draw, [tx, 360, tx + 260, 360 + 50], 12, INK_RGB)
    font_badge = get_font(16, "bold")
    draw_text(draw, "GET IT ON", (tx + 20, 375), get_font(11, "regular"), (148, 163, 184), "lt")
    draw_text(draw, "Google Play", (tx + 20, 390), font_badge, SURFACE_WHITE_RGB, "lt")

    return img


# ───────────────────────── App icon ─────────────────────────
def render_app_icon(size, logo):
    img = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    # subtle background gradient
    grad = gradient((size, size), (255, 255, 255), (250, 252, 254), "diagonal")
    img.paste(grad, (0, 0))
    # fit logo in center with padding
    pad = size // 10
    avail = size - pad * 2
    logo_resized = logo.resize((avail, int(logo.height * avail / logo.width)), Image.LANCZOS)
    # ensure it fits vertically
    if logo_resized.height > avail:
        logo_resized = logo.resize((int(logo.width * avail / logo.height), avail), Image.LANCZOS)
    lx = size // 2 - logo_resized.width // 2
    ly = size // 2 - logo_resized.height // 2
    img.paste(logo_resized, (lx, ly), logo_resized)
    return img.convert("RGB")


# ───────────────────────── Main ─────────────────────────
def main():
    logo = Image.open(LOGO_PATH).convert("RGBA")

    phone_w, phone_h = 1080, 1920
    large_w, large_h = 1440, 2560

    screens = {
        "home": render_home,
        "kid_detail": render_kid_detail,
        "diet": render_diet,
        "camps": render_camps,
    }

    # Feature graphic
    fg = render_feature_graphic(1024, 500, logo)
    fg.save(os.path.join(OUT_DIR, "feature_graphic_1024x500.png"), "PNG")
    print("Saved feature_graphic_1024x500.png")

    # App icon
    icon = render_app_icon(512, logo)
    icon.save(os.path.join(OUT_DIR, "icon_512.png"), "PNG")
    print("Saved icon_512.png")

    # Phone screenshots
    for name, renderer in screens.items():
        img = renderer(phone_w, phone_h, logo)
        path = os.path.join(OUT_DIR, f"phone_screenshot_{name}.png")
        img.save(path, "PNG", optimize=True)
        print(f"Saved phone_screenshot_{name}.png")

    # 7-inch tablet (same res accepted)
    for name, renderer in screens.items():
        img = renderer(phone_w, phone_h, logo)
        path = os.path.join(OUT_DIR, f"tablet7_screenshot_{name}.png")
        img.save(path, "PNG", optimize=True)
        print(f"Saved tablet7_screenshot_{name}.png")

    # 10-inch tablet / Chromebook / Android XR (upscaled to 1440x2560)
    for name, renderer in screens.items():
        base = renderer(phone_w, phone_h, logo)
        large = base.resize((large_w, large_h), Image.LANCZOS)
        large.save(os.path.join(OUT_DIR, f"tablet10_screenshot_{name}.png"), "PNG", optimize=True)
        large.save(os.path.join(OUT_DIR, f"chromebook_screenshot_{name}.png"), "PNG", optimize=True)
        large.save(os.path.join(OUT_DIR, f"android_xr_screenshot_{name}.png"), "PNG", optimize=True)
        print(f"Saved scaled variants for {name}")


if __name__ == "__main__":
    main()
