"""
Turns the original Canva PNG exports into editable starter artwork:
  * public/assets/brand/*.png   – logos, signatures, seals cut out with transparency
  * public/assets/backgrounds/*.jpg – each certificate frame with all text/logos removed

Usage: python scripts/extract_art.py [name ...]   (no args = everything)
Source PNGs are the folders in the project root (git-ignored).
"""
import os, sys
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, "public", "assets", "brand")
BG = os.path.join(ROOT, "public", "assets", "backgrounds")
os.makedirs(BRAND, exist_ok=True)
os.makedirs(BG, exist_ok=True)


def load(rel):
    img = cv2.imread(os.path.join(ROOT, rel), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"missing {rel}")
    return img


def cut(src, box, name, t0=12, t1=70):
    """Crop box=(x1,y1,x2,y2), make the surrounding background transparent, trim, save RGBA PNG."""
    x1, y1, x2, y2 = box
    crop = src[y1:y2, x1:x2].astype(np.float32)
    border = np.concatenate([crop[0], crop[-1], crop[:, 0], crop[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((crop - bg) ** 2).sum(axis=2))
    a = np.clip((dist - t0) / (t1 - t0), 0, 1)
    # un-premultiply against the background so edges don't keep a halo
    safe = np.maximum(a, 1e-3)[..., None]
    rgb = np.clip((crop - (1 - a[..., None]) * bg) / safe, 0, 255)
    rgba = np.dstack([rgb, a * 255]).astype(np.uint8)
    ys, xs = np.where(a > 0.05)
    if len(xs) == 0:
        raise SystemExit(f"nothing found for {name}")
    pad = 2
    rgba = rgba[max(0, ys.min() - pad): ys.max() + pad + 1, max(0, xs.min() - pad): xs.max() + pad + 1]
    cv2.imwrite(os.path.join(BRAND, name + ".png"), rgba)
    return (x1 + max(0, xs.min() - pad), y1 + max(0, ys.min() - pad), rgba.shape[1], rgba.shape[0])


def erase(img, boxes, out, quality=90):
    """Remove text/logos inside boxes. Each box: (x1,y1,x2,y2,kernel,threshold).
    Background is estimated with a morphological closing (removes dark strokes thinner than kernel);
    pixels much darker than that estimate are inpainted."""
    res = img.copy()
    mask = np.zeros(img.shape[:2], np.uint8)
    for (x1, y1, x2, y2, k, thr, *mode) in boxes:
        mode = mode[0] if mode else "dark"
        crop = img[y1:y2, x1:x2]
        if mode == "rect":  # wipe the whole box
            mask[y1:y2, x1:x2] = 255
            continue
        kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        bgest = cv2.morphologyEx(crop, cv2.MORPH_CLOSE, kern)
        diff = (bgest.astype(np.int16) - crop.astype(np.int16)).max(axis=2)
        if mode == "both":  # also catch items lighter than the background (white cards, glows)
            light = cv2.morphologyEx(crop, cv2.MORPH_OPEN, kern)
            diff = np.maximum(diff, (crop.astype(np.int16) - light.astype(np.int16)).max(axis=2))
        m = (diff > thr).astype(np.uint8) * 255
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        mask[y1:y2, x1:x2] = np.maximum(mask[y1:y2, x1:x2], m)
    res = cv2.inpaint(res, mask, 9, cv2.INPAINT_TELEA)
    cv2.imwrite(os.path.join(BG, out + ".jpg"), res, [cv2.IMWRITE_JPEG_QUALITY, quality])
    cv2.imwrite(os.path.join(ROOT, ".art-debug-" + out + ".jpg"), cv2.resize(res, None, fx=0.5, fy=0.5), [cv2.IMWRITE_JPEG_QUALITY, 80])
    return res


JOBS = {}
def job(f):
    JOBS[f.__name__] = f
    return f


@job
def brand():
    g = load("Freshathon 2.0/2.png")  # plain white background: cleanest cut-outs
    print("rit", cut(g, (400, 210, 800, 312), "rit-logo"))
    print("nba", cut(g, (855, 215, 985, 310), "nba"))
    print("naac", cut(g, (1035, 205, 1180, 315), "naac"))
    print("iic", cut(g, (1225, 212, 1425, 310), "iic"))
    print("sdg", cut(g, (1472, 205, 1592, 320), "sdg-wheel"))
    print("ribbon", cut(g, (1605, 170, 1935, 615), "ribbon-seal"))
    print("sig", cut(g, (880, 995, 1100, 1117), "signature-maheswari", t0=20, t1=90))
    f = load("FUTUREPRENEUR 25 26/3.png")
    print("rit-tag", cut(f, (220, 105, 595, 225), "rit-logo-tagline"))
    print("tn", cut(f, (650, 100, 780, 240), "tn-emblem"))
    print("edii", cut(f, (840, 92, 1005, 245), "edii-tn"))
    print("sig-mani", cut(f, (345, 1040, 565, 1168), "signature-manimaran", t0=20, t1=90))
    print("sig-shan", cut(f, (835, 1060, 1160, 1140), "signature-shanmuga", t0=20, t1=90))
    gm = load("Gameathon Certificate/1.png")
    print("gameathon", cut(gm, (815, 88, 1312, 240), "gameathon-logo", t0=25, t1=80))
    print("revgames", cut(gm, (1380, 100, 1700, 230), "revolution-games", t0=25, t1=80))
    print("8q", cut(gm, (600, 320, 815, 420), "8queens", t0=6, t1=30))
    print("inspire", cut(gm, (893, 320, 1107, 420), "inspire", t0=6, t1=30))
    print("distinct", cut(gm, (1188, 320, 1397, 420), "distinct", t0=6, t1=30))
    print("sig-sath", cut(gm, (445, 1128, 690, 1222), "signature-sathiya", t0=25, t1=90))
    print("sig-vid", cut(gm, (898, 1128, 1135, 1226), "signature-vidhushavarshini", t0=25, t1=90))
    d = load("Designathon/1.png")
    print("sss", cut(d, (1320, 108, 1420, 210), "swadeshi-shodh-sansthan"))
    fb = load("Freshathon/1.png")
    print("fresh-title", cut(fb, (780, 330, 1265, 430), "freshathon-2-title", t0=30, t1=90))
    ip = load("IP Rights/(English).png")
    print("medal", cut(ip, (594, 374, 722, 529), "gold-medal", t0=18, t1=60))


@job
def ip_day():
    img = load("IP Rights/(English).png")
    erase(img, [
        (480, 55, 1530, 175, 151, 25),   # logo row
        (150, 185, 1850, 540, 131, 30),  # headings + medal
        (150, 560, 1850, 965, 61, 40),   # body, date, place
        (760, 1030, 1240, 1290, 81, 30), # signature block
    ], "ip-day")


@job
def fresh_blue():
    img = load("Freshathon/1.png")
    erase(img, [
        (400, 150, 1610, 270, 151, 22),
        (185, 300, 1815, 650, 151, 30),
        (185, 660, 1815, 900, 61, 40),
        (770, 990, 1230, 1245, 81, 30),
    ], "freshathon-blue")


@job
def fresh_gold():
    img = load("Freshathon 2.0/2.png")
    erase(img, [
        (395, 195, 1600, 320, 151, 20),
        (1600, 165, 1940, 620, 0, 0, "rect"),
        (190, 330, 1600, 520, 151, 25),
        (190, 630, 1810, 890, 61, 40),
        (850, 990, 1150, 1225, 81, 25),
    ], "freshathon-gold")


@job
def designathon():
    img = load("Designathon/1.png")
    erase(img, [
        (500, 110, 1425, 210, 131, 22),
        (330, 212, 1590, 490, 131, 28),
        (330, 495, 1590, 730, 55, 40),
        (780, 755, 1140, 950, 81, 28),
    ], "designathon")


@job
def gameathon():
    img = load("Gameathon Certificate/1.png")
    erase(img, [
        (250, 85, 1705, 425, 171, 18, "both"),
        (585, 315, 650, 425, 0, 0, "rect"),
        (80, 445, 1925, 640, 131, 40),
        (78, 690, 1925, 1010, 61, 70),
        (395, 1120, 1605, 1330, 81, 40),
    ], "gameathon")


@job
def futurepreneur():
    img = load("FUTUREPRENEUR 25 26/3.png")
    erase(img, [
        (215, 92, 1790, 250, 171, 22),
        (155, 255, 1845, 515, 131, 35),
        (155, 540, 1845, 935, 55, 70),
        (285, 1035, 1715, 1255, 81, 35),
    ], "futurepreneur")


@job
def japan():
    img = load("FUTUREPRENEUR 25 26/7.png")
    erase(img, [
        (705, 80, 1295, 210, 131, 25),
        (455, 280, 1545, 350, 71, 40),
        (270, 435, 1730, 520, 91, 40),
        (85, 595, 1908, 880, 55, 45),
        (815, 985, 1185, 1195, 41, 40),
    ], "japan")


if __name__ == "__main__":
    names = sys.argv[1:] or list(JOBS)
    for n in names:
        print("==", n)
        JOBS[n]()
