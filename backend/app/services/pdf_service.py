import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from sqlalchemy.orm import Session

from app.models.debt import DebtItem
from app.models.incident import Incident
from app.models.causal import CauseNode
from app.models.repository import FileHotspot
from app.services.knapsack_optimiser import solve_knapsack_remediation
from app.utils import utc_now

def generate_pdf_report(db: Session, project_id: int) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1E293B'),
        fontName='Helvetica-Bold'
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748B'),
        fontName='Helvetica'
    )
    h2_style = ParagraphStyle(
        'Heading2Custom',
        parent=styles['Heading2'],
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#0F172A'),
        fontName='Helvetica-Bold',
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyCustom',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    story = []

    # Title & Subtitle
    story.append(Paragraph("DebtLens: Technical Debt Intelligence Report", title_style))
    story.append(Paragraph(
        f"Generated: {utc_now().strftime('%Y-%m-%d %H:%M UTC')} | Basaveshwar Engineering College Bagalkote | Dept of ISE",
        subtitle_style
    ))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#4F46E5'), spaceAfter=14))

    # 1. Executive Summary Cards / Table
    incidents = db.query(Incident).filter(Incident.project_id == project_id).all()
    debts = db.query(DebtItem).filter(DebtItem.project_id == project_id).all()
    hotspots = db.query(FileHotspot).filter(FileHotspot.project_id == project_id).all()

    total_principal = sum(d.effort_principal for d in debts)
    total_interest = sum(d.accrued_interest for d in debts)
    past_breakeven = sum(1 for d in debts if d.break_even_status)
    net_drag = total_interest - total_principal

    summary_data = [
        ["Total Incidents", "Registered Debt Items", "Principal Effort", "Accrued Interest", "Break-Even Items"],
        [
            str(len(incidents)),
            str(len(debts)),
            f"{total_principal:.1f} hrs",
            f"{total_interest:.1f} hrs",
            f"{past_breakeven} ({past_breakeven/max(1, len(debts))*100:.0f}%)"
        ]
    ]

    summary_table = Table(summary_data, colWidths=[108]*5)
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#334155')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, 1), 12),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 12))

    # 2. Systemic Root Causes (Causal Centrality)
    story.append(Paragraph("Systemic Root Causes (Causal Graph Centrality Analysis)", h2_style))
    causes = db.query(CauseNode).filter(CauseNode.project_id == project_id).order_by(CauseNode.betweenness_centrality.desc()).limit(5).all()
    
    cause_data = [["Root Cause Description", "Category", "Betweenness", "Degree Centrality"]]
    for c in causes:
        cause_data.append([
            c.description[:55],
            c.category,
            f"{c.betweenness_centrality:.4f}",
            f"{c.degree_centrality:.4f}"
        ])

    cause_table = Table(cause_data, colWidths=[240, 100, 100, 100])
    cause_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EEF2FF')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#3730A3')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(cause_table)
    story.append(Spacer(1, 12))

    # 3. Knapsack Recommended Remediation Plan
    story.append(Paragraph("Recommended Remediation Schedule (0/1 Knapsack Constrained Optimisation, Budget: 40 hrs)", h2_style))
    plan = solve_knapsack_remediation(db, project_id, sprint_budget_hours=40.0)
    
    plan_data = [["Key", "Remediation Task", "Module", "Principal", "Interest", "Risk Reduction", "Status"]]
    for item in plan["selected_items"]:
        status_txt = "BREAK-EVEN EXCEEDED" if item["break_even_status"] else "OPTIMAL"
        plan_data.append([
            item["debt_key"],
            item["title"][:40],
            item["module_name"],
            f"{item['effort_principal']:.1f}h",
            f"{item['accrued_interest']:.1f}h",
            f"{item['risk_score']:.1f}",
            status_txt
        ])

    plan_table = Table(plan_data, colWidths=[55, 175, 90, 50, 50, 60, 60])
    plan_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ECFDF5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#065F46')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (3, 0), (5, -1), 'RIGHT'),
        ('ALIGN', (6, 0), (6, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(plan_table)
    story.append(Spacer(1, 14))

    # Signatures
    story.append(Paragraph("Project Team & Endorsement:", ParagraphStyle('SubHeader', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9)))
    sign_data = [
        ["Student Associate", "USN", "Guide", "Designation"],
        ["Suraj H Deshpande", "2BA24IS171", "Prof. P. R. Muttannavar", "Assistant Professor"],
        ["Sushma Hiremath", "2BA24IS172", "", ""],
        ["Sushma K Patil", "2BA24IS173", "", ""],
        ["Sushma Mathapati", "2BA24IS174", "", "Dept. of Information Science & Engg."]
    ]
    sign_table = Table(sign_data, colWidths=[150, 100, 140, 150])
    sign_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#475569')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(sign_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

