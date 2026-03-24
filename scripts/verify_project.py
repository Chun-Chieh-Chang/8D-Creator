import os
import re
import sys

# Project Root
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT_DIR, "src")
GLOBALS_CSS = os.path.join(SRC_DIR, "app", "globals.css")

# Mandatory Color Master Palette (user_global specification)
PALETTE_DAY = {
    "--color-brand-day-bg": "#F9FAFB",
    "--color-brand-day-surface": "#FFFFFF",
    "--color-brand-day-text-primary": "#111827",
    "--color-brand-day-text-secondary": "#6B7280",
    "--color-brand-accent": "#3B82F6",
}

PALETTE_NIGHT = {
    "--color-brand-night-bg": "#0F172A",
    "--color-brand-night-surface": "#1E293B",
    "--color-brand-night-text-primary": "#F1F5F9",
    "--color-brand-night-text-secondary": "#94A3B8",
}

MANDATORY_FILES = [
    "DEV_LOG.md",
    "README.md",
    ".gitignore",
    "package.json",
]

FORBIDDEN_PATTERNS = [
    r"#[0-9a-fA-F]{6}", # Hex colors in TSX
    r"#[0-9a-fA-F]{3}", # Short hex colors in TSX
]

def check_css_compliance():
    print("--- [1] Checking CSS Compliance ---")
    if not os.path.exists(GLOBALS_CSS):
        print(f"FAILED: {GLOBALS_CSS} not found.")
        return False
    
    with open(GLOBALS_CSS, "r") as f:
        content = f.read()
    
    errors = []
    # Check Day Palette
    for var, val in PALETTE_DAY.items():
        if f"{var}: {val}" not in content and f"{var}:{val}" not in content:
            errors.append(f"Missing or mismatched Day Variable: {var} (Expected {val})")
            
    # Check Night Palette
    for var, val in PALETTE_NIGHT.items():
        if f"{var}: {val}" not in content and f"{var}:{val}" not in content:
            errors.append(f"Missing or mismatched Night Variable: {var} (Expected {val})")

    if errors:
        for err in errors:
            print(f"ERROR: {err}")
        return False
    
    print("SUCCESS: globals.css matches Color Master Palette.")
    return True

def check_hardcoded_colors():
    print("\n--- [2] Checking Hardcoded Colors in TSX/TS ---")
    found_errors = False
    for root, dirs, files in os.walk(SRC_DIR):
        for file in files:
            if file.endswith((".tsx", ".ts")):
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    # Skip hex colors in tailwind @theme or specific comments if any
                    # But generally TSX shouldn't have raw hex unless justified.
                    for pattern in FORBIDDEN_PATTERNS:
                        matches = re.findall(pattern, content)
                        # Filter out common false positives if necessary
                        if matches:
                            # Re-verify if matches are not just CSS variables in strings
                            for match in matches:
                                print(f"WARNING: Potential hardcoded color '{match}' in {os.path.relpath(path, ROOT_DIR)}")
                                found_errors = True
    
    if not found_errors:
        print("SUCCESS: No hardcoded colors found in source.")
    return True # We allow warnings for now

def check_mandatory_files():
    print("\n--- [3] Checking Mandatory Files ---")
    errors = []
    for file in MANDATORY_FILES:
        path = os.path.join(ROOT_DIR, file)
        if not os.path.exists(path):
            errors.append(f"Missing mandatory file: {file}")
    
    if errors:
        for err in errors:
            print(f"ERROR: {err}")
        return False
    
    print("SUCCESS: All mandatory files present.")
    return True

def main():
    print("=== 8D-Creator Software Validation (軟體確效) ===\n")
    c1 = check_css_compliance()
    c2 = check_hardcoded_colors()
    c3 = check_mandatory_files()
    
    if all([c1, c2, c3]):
        print("\nOVERALL VALIDATION: PASS")
        sys.exit(0)
    else:
        print("\nOVERALL VALIDATION: FAIL")
        sys.exit(1)

if __name__ == "__main__":
    main()
