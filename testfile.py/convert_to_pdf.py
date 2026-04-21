#!/usr/bin/env python3
"""
Basic text to PDF converter
"""

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm

def create_simple_pdf(md_file, pdf_file):
    """Create a simple PDF from markdown file"""

    # Read the markdown file
    with open(md_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Create PDF
    c = canvas.Canvas(pdf_file, pagesize=A4)
    width, height = A4

    # Set font
    c.setFont("Helvetica", 12)

    # Split content into lines
    lines = content.split('\n')

    y_position = height - 50  # Start near top
    line_height = 15

    for line in lines:
        # Skip empty lines
        if not line.strip():
            y_position -= line_height
            continue

        # Handle headings
        if line.startswith('# '):
            c.setFont("Helvetica-Bold", 16)
            text = line[2:].strip()
        elif line.startswith('## '):
            c.setFont("Helvetica-Bold", 14)
            text = line[3:].strip()
        elif line.startswith('### '):
            c.setFont("Helvetica-Bold", 12)
            text = line[4:].strip()
        elif line.startswith('- '):
            c.setFont("Helvetica", 10)
            text = "• " + line[2:].strip()
        else:
            c.setFont("Helvetica", 10)
            text = line.strip()

        # Clean up markdown formatting
        text = text.replace('**', '').replace('*', '').replace('`', '')

        # Wrap long lines
        if len(text) > 80:
            words = text.split()
            current_line = ""
            for word in words:
                if len(current_line + " " + word) < 80:
                    current_line += " " + word if current_line else word
                else:
                    c.drawString(50, y_position, current_line)
                    y_position -= line_height
                    current_line = word

                    # Check if we need a new page
                    if y_position < 50:
                        c.showPage()
                        c.setFont("Helvetica", 10)
                        y_position = height - 50

            if current_line:
                c.drawString(50, y_position, current_line)
                y_position -= line_height
        else:
            c.drawString(50, y_position, text)
            y_position -= line_height

        # Check if we need a new page
        if y_position < 50:
            c.showPage()
            c.setFont("Helvetica", 10)
            y_position = height - 50

    c.save()
    print(f"PDF created successfully: {pdf_file}")

if __name__ == "__main__":
    create_simple_pdf("project_documentation.md", "SEP_AI_Project_Documentation.pdf")