import re

with open('src/pages/Dashboard.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

with open('src/pages/Dashboard.jsx', 'r', encoding='utf-8') as f:
    jsx_content = f.read()

# Remove the CSS import
jsx_content = jsx_content.replace("import './Dashboard.css'", "")

# Add style tag inside AdminLayout
style_tag = f'<style>{{\n`\n{css_content}\n`\n}}</style>'
jsx_content = jsx_content.replace('<AdminLayout>', f'<AdminLayout>\n      {style_tag}')

with open('src/pages/Dashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(jsx_content)
