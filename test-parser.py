#!/usr/bin/env python3

import re
import json

# Read the debug HTML
with open('data/debug-date-response.html', 'r') as f:
    html = f.read()

print('='*60)
print('Testing HTML Parser')
print('='*60)

# Step 1: Find GridView1 table (use greedy match to get to the real closing tag, not the nested one)
grid_match = re.search(r'<table[^>]+id="GridView1"[^>]*>([\s\S]*)</table>', html, re.IGNORECASE)

if not grid_match:
    print('❌ GridView1 table not found!')
    exit(1)

print('✅ GridView1 table found')
table_html = grid_match.group(1)
print(f'   Table HTML length: {len(table_html)} chars')

# Step 2: Remove caption
table_without_caption = re.sub(r'<caption[^>]*>[\s\S]*?</caption>', '', table_html, flags=re.IGNORECASE)
print(f'✅ After caption removal: {len(table_without_caption)} chars')

# Step 3: Find all rows
rows = re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', table_without_caption, re.IGNORECASE)
print(f'✅ Found {len(rows)} rows (including header)')

# Step 4: Parse data rows
periods = []

for i, row_content in enumerate(rows):
    if i == 0:  # Skip header row
        continue

    # Find all td cells
    cells = re.findall(r'<td[^>]*>([\s\S]*?)</td>', row_content, re.IGNORECASE)
    # Remove any HTML tags and trim
    cells = [re.sub(r'<[^>]+>', '', cell).strip() for cell in cells]

    if i <= 3:
        print(f'   Row {i}: Found {len(cells)} cells - {cells}')

    if len(cells) >= 2:
        time_text = cells[0]
        gen_text = cells[1]

        # Check if generation matches digit pattern
        gen_match = re.match(r'^[\d.]+$', gen_text)

        if i <= 3:
            print(f'      timeText="{time_text}", genText="{gen_text}", genMatch={bool(gen_match)}')

        if time_text and gen_match:
            generation = float(gen_text)
            periods.append({
                'time': time_text,
                'generation': generation,
                'status': 'peak' if generation > 50 else ('active' if generation > 10 else 'base'),
                'source': 'USACE Real-time'
            })

print()
print('='*60)
print(f'📊 RESULT: Found {len(periods)} periods')
print('='*60)

if periods:
    print('\nFirst 5 periods:')
    for i, p in enumerate(periods[:5]):
        print(f'   {i+1}. {p["time"]}: {p["generation"]} MW ({p["status"]})')
    print('\n✅ SUCCESS - Parser logic is correct!')
else:
    print('\n❌ FAILURE - No periods were parsed')
    print('This means there is a bug in the JavaScript parsing code')
