import sys
import os
import shutil
from PIL import Image

def convert_icon(source_path, target_dir="assets"):
    if not os.path.exists(source_path):
        print(f"Error: Source image '{source_path}' not found.")
        sys.exit(1)

    os.makedirs(target_dir, exist_ok=True)
    
    try:
        img = Image.open(source_path)
        img = img.convert("RGBA")
    except Exception as e:
        print(f"Error loading image: {e}")
        sys.exit(1)

    # Windows standard icon sizes
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

    ico_path = os.path.join(target_dir, "icon.ico")
    png_path = os.path.join(target_dir, "icon.png")
    tray_path = os.path.join(target_dir, "tray-icon.png")

    # Save 256x256 master PNG
    img_256 = img.resize((256, 256), Image.Resampling.LANCZOS)
    img_256.save(png_path, format="PNG")
    print(f"Created: {png_path} (256x256)")

    # Save 32x32 crisp tray PNG
    img_32 = img.resize((32, 32), Image.Resampling.LANCZOS)
    img_32.save(tray_path, format="PNG")
    print(f"Created: {tray_path} (32x32)")

    # Save multi-resolution Windows ICO for NSIS installer, shortcut, taskbar
    img_256.save(ico_path, format="ICO", sizes=sizes)
    print(f"Created: {ico_path} (multi-res ICO: {', '.join(f'{w}x{h}' for w, h in sizes)})")

    # Generate Browser Extension icons
    ext_dirs = [
        os.path.join(os.path.dirname(__file__), "..", "browser-extension"),
        os.path.join(os.path.dirname(__file__), "..", "..", "browser-extension")
    ]
    ext_sizes = [(16, "icon16.png"), (48, "icon48.png"), (128, "icon128.png")]
    for ext_dir in ext_dirs:
        if os.path.exists(ext_dir):
            for s, fname in ext_sizes:
                ext_icon = img.resize((s, s), Image.Resampling.LANCZOS)
                ext_icon_path = os.path.join(ext_dir, fname)
                ext_icon.save(ext_icon_path, format="PNG")
                print(f"Created: {ext_icon_path} ({s}x{s})")

    print("\nIcon generation completed successfully!")
    print("Icons configured for:")
    print("1. Desktop Agent Window & Taskbar")
    print("2. System Tray (Notification Area)")
    print("3. Windows NSIS Installer & Uninstaller")
    print("4. Desktop Shortcut & Start Menu Shortcut")
    print("5. Chrome/Edge/Brave Browser Extension Companion")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/convert-icon.py <path-to-image> [output-dir]")
        sys.exit(1)

    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "assets")
    convert_icon(src, out)
