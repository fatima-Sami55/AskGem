import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDF = (profile, roadmapData, recommendations) => {
    console.log("PDFGenerator received:", { profile, roadmapData, recommendations });

    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        // --- Header ---
        doc.setFontSize(22);
        doc.setTextColor(41, 98, 255); // Blue
        doc.text("AskPeri - Academic Roadmap", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 26);
        doc.line(14, 30, pageWidth - 14, 30);

        let yPos = 40;

        // --- Student Profile Summary ---
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text("Student Profile", 14, yPos);
        yPos += 10;

        doc.setFontSize(11);
        doc.setTextColor(50);
        const profileInfo = [
            `Name: ${profile.name || 'N/A'}`,
            `Current Education: ${profile.currentEducation || 'N/A'}`,
            `Target Major: ${profile.intended_major || 'N/A'}`,
            `Target Country: ${profile.country_preference || 'N/A'}`,
            `Budget: ${profile.budget_range || 'N/A'}`
        ];

        profileInfo.forEach(line => {
            doc.text(line, 14, yPos);
            yPos += 7;
        });

        yPos += 5;

        // --- Executive Summary (from Recommendations) ---
        if (recommendations && recommendations.summary) {
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text("AI Executive Summary", 14, yPos);
            yPos += 8;

            doc.setFontSize(10);
            doc.setTextColor(60);
            const splitSummary = doc.splitTextToSize(recommendations.summary, pageWidth - 28);
            doc.text(splitSummary, 14, yPos);
            yPos += (splitSummary.length * 5) + 10;
        }

        // --- Top Recommendations ---
        if (recommendations && recommendations.recommendations) {
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text("Top University Recommendations", 14, yPos);
            yPos += 8;

            const tableData = recommendations.recommendations.map(rec => [
                rec.university,
                rec.country,
                rec.major,
                rec.tuition_fees,
                rec.admission_probability
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['University', 'Country', 'Major', 'Tuition', 'Chance']],
                body: tableData,
                headStyles: { fillColor: [41, 98, 255] },
                theme: 'grid'
            });

            yPos = doc.lastAutoTable.finalY + 15;
        }

        // --- Roadmap Timeline ---
        if (roadmapData && roadmapData.roadmap) {
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text("Strategic Roadmap", 14, yPos);
            yPos += 8;

            const roadmapRows = roadmapData.roadmap.map(phase => [
                phase.phase,
                phase.timeline || 'N/A',
                phase.actions ? phase.actions.join('\n• ') : '', // bullet points
                phase.cost_estimate || '-'
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['Phase', 'Timeline', 'Key Actions', 'Est. Cost']],
                body: roadmapRows,
                headStyles: { fillColor: [76, 175, 80] }, // Green for roadmap
                theme: 'grid',
                styles: { cellPadding: 3, fontSize: 10 },
                columnStyles: {
                    2: { cellWidth: 80 } // Wider column for actions
                }
            });

            yPos = doc.lastAutoTable.finalY + 15;
        }

        // --- Risks & Alternatives ---
        if (recommendations && recommendations.risks) {
            // Check page break
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setTextColor(200, 50, 50); // Red
            doc.text("Key Risks to Consider", 14, yPos);
            yPos += 8;

            doc.setFontSize(10);
            doc.setTextColor(50);
            recommendations.risks.forEach(risk => {
                doc.text(`• ${risk}`, 14, yPos);
                yPos += 6;
            });
        }

        // Save
        doc.save(`AskPeri_Roadmap_${profile.name || 'Student'}.pdf`);
    } catch (error) {
        console.error("Internal PDF Generator Error:", error);
        throw error;
    }
};
