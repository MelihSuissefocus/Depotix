#!/usr/bin/env python3
import os
import ast
import re
import sys

def find_manifests(root_dirs):
    manifests = []
    for root_dir in root_dirs:
        for root, dirs, files in os.walk(root_dir):
            if '__manifest__.py' in files:
                manifests.append(os.path.join(root, '__manifest__.py'))
    return manifests

def check_encoding(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            f.read()
        return True
    except UnicodeDecodeError:
        return False

def parse_manifest(content):
    try:
        return ast.literal_eval(content)
    except (ValueError, SyntaxError):
        return None

def repair_content(content):
    # Replace true/false/null with True/False/None
    content = re.sub(r'\btrue\b', 'True', content)
    content = re.sub(r'\bfalse\b', 'False', content)
    content = re.sub(r'\bnull\b', 'None', content)
    
    # Remove trailing commas in dicts and lists
    # This is a simple regex, may not cover all cases
    content = re.sub(r',\s*}', '}', content)
    content = re.sub(r',\s*]', ']', content)
    
    return content

def validate_and_repair(file_path):
    if not check_encoding(file_path):
        print(f"Encoding error in {file_path}")
        return False
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    content = repair_content(content)
    
    manifest = parse_manifest(content)
    if manifest is None:
        print(f"Syntax error in {file_path}")
        return False
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Repaired {file_path}")
    
    return True

def main():
    root_dirs = ['addons', 'odoo/addons']
    manifests = find_manifests(root_dirs)
    errors = 0
    
    for manifest in manifests:
        if not validate_and_repair(manifest):
            errors += 1
    
    if errors > 0:
        print(f"Found {errors} errors.")
        sys.exit(1)
    else:
        print("All manifests are valid.")

if __name__ == '__main__':
    main()
