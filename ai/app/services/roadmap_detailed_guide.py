"""
Pre-researched expandable roadmap guides — actionable steps, not manual research checklists.
"""
from __future__ import annotations

from app.services.university_sources import CURATED_UNIVERSITIES


def _english_test_label(profile: dict) -> str:
    english = profile.get("english_test") or {}
    test_type = english.get("testType") or "IELTS"
    if test_type in ("None", "none", "", None):
        return "IELTS or TOEFL"
    return str(test_type)


def _step(title: str, summary: str, details: list[str], url: str | None = None) -> dict:
    return {"title": title, "summary": summary, "details": details, "url": url}


def _germany_masters_phases(profile: dict) -> list[dict]:
    major = profile.get("major") or "Computer Science"
    nationality = profile.get("nationality") or "Pakistani"
    test_label = _english_test_label(profile)
    cgpa = profile.get("cgpa")
    gpa_line = (
        f"Your CGPA is {cgpa} — prioritize RWTH, Stuttgart, and Dresden if below 3.3."
        if cgpa is not None
        else "Add your CGPA so Peri can flag realistic programs."
    )

    curated = CURATED_UNIVERSITIES.get("Germany", [])
    uni_steps = []
    for uni in curated[:6]:
        uni_steps.append(
            _step(
                f"{uni['name']} — {uni.get('program', major)}",
                f"{uni.get('tuition', 'Semester contribution only')}. "
                f"Min GPA ~{uni.get('minGpa', '2.5')}, IELTS {uni.get('ieltsMin', 6.5)}+.",
                [
                    f"Official programs page: {uni['sourceUrl']}",
                    "Winter intake deadlines: typically Apr–Jul (Stuttgart: Dec–Feb — check early)",
                    "Apply via the university's own portal unless uni-assist VPD is listed on their site",
                    "Required: APS certificate, transcripts, CV, SOP, 2 references, English score",
                    "Public universities: no tuition, only semester contribution (~€150–300/semester)",
                ],
                uni["sourceUrl"],
            )
        )

    return [
        {
            "phase": 1,
            "title": f"Exams, APS & eligibility — {major}",
            "timeline": "Months 1–2",
            "description": f"Set up English test, APS verification, and documents. {gpa_line}",
            "steps": [
                f"Register and prepare for {test_label}.",
                "Start APS certificate application.",
                "Gather and attest academic documents.",
            ],
            "stepDetails": [
                _step(
                    f"Register for {test_label} Academic",
                    "German CS MSc programs typically require IELTS 6.5 (6.0 per band) or TOEFL iBT 87–90.",
                    [
                        "Go to ielts.org → Book a test → Choose IELTS Academic",
                        "Select a test center in Pakistan; book 8–10 weeks ahead",
                        "Target 6.5 overall, minimum 6.0 in each section",
                        "Results in ~13 days; send TRF electronically to each university",
                    ],
                    "https://www.ielts.org/for-test-takers/book-a-test",
                ),
                _step(
                    "Apply for APS Certificate",
                    "Mandatory for Pakistani degrees. Processing takes 4–8 weeks.",
                    [
                        "Register at aps.org.pk with passport details",
                        "Upload HEC-attested degrees, transcripts, passport copy, photo",
                        "Pay application fee and submit — start in Month 1",
                        "Upload APS certificate PDF with every German application",
                    ],
                    "https://www.aps.org.pk/",
                ),
                _step(
                    "Prepare academic documents",
                    "Attested and translated documents required for all applications.",
                    [
                        "Official transcripts from registrar; HEC attestation (hec.gov.pk)",
                        "Certified English/German translations if needed",
                        "Module descriptions for uni-assist VPD where required",
                        "Draft 1-page academic CV with projects and skills",
                    ],
                ),
                _step(
                    "Understand uni-assist vs direct applications",
                    "Some universities require uni-assist VPD before portal application.",
                    [
                        "uni-assist fee ~€75 first uni + ~€30 each additional",
                        "Processing 4–6 weeks — submit before portal deadlines",
                        "TUM/RWTH: usually direct; TU Berlin: often uni-assist first",
                    ],
                    "https://www.uni-assist.de/en/",
                ),
            ],
        },
        {
            "phase": 2,
            "title": f"Shortlist universities & draft SOP — {major}",
            "timeline": "Months 3–4",
            "description": f"Pick 5–6 programs and prepare essays. {gpa_line}",
            "steps": [
                f"Compare {len(curated[:6])} curated {major} programs in Germany.",
                "Write Statement of Purpose (800–1,000 words).",
                "Request 2–3 academic reference letters.",
            ],
            "stepDetails": uni_steps
            + [
                _step(
                    "Write your Statement of Purpose",
                    "Tailor the final paragraph to each university.",
                    [
                        "Structure: hook → background → experience → why this program → career goals",
                        "Length 800–1,000 words unless portal specifies otherwise",
                        "Name specific professors, labs, or courses at that university",
                        "Have a professor review before submission",
                    ],
                ),
                _step(
                    "Request reference letters",
                    "2 academic references from professors who know your work.",
                    [
                        "Email 3–4 weeks before deadlines with CV, transcript, SOP draft",
                        "Provide bullet points of projects they can mention",
                        "Register referees on portals early — some use online systems",
                    ],
                ),
            ],
        },
        {
            "phase": 3,
            "title": f"Submit applications & funding — {nationality} students",
            "timeline": "Months 5–8",
            "description": "Submit portal applications and apply for scholarships.",
            "steps": [
                "Submit via official portals before each deadline.",
                "Apply for DAAD scholarships.",
                "Prepare financial proof for visa.",
            ],
            "stepDetails": [
                _step(
                    "Submit university applications",
                    "Apply to 5–6 programs; start with earliest deadlines.",
                    [
                        "Create portal accounts (TUMonline, RWTHonline, SELMA, etc.) early",
                        "Upload APS, transcripts, CV, SOP, references, English score",
                        "Save confirmation PDFs and application IDs",
                        "Decision time: typically 4–12 weeks after deadline",
                    ],
                ),
                _step(
                    "Apply for DAAD scholarships",
                    "Competitive stipends for international graduates.",
                    [
                        "Search daad.de scholarships — filter Pakistan + Masters + your field",
                        "Deadlines often 6–12 months before study start",
                        "Submit through DAAD portal plus university admission",
                    ],
                    "https://www.daad.de/en/studying-in-germany/scholarships/",
                ),
                _step(
                    "Prepare financial proof",
                    "Required for visa even when tuition-free.",
                    [
                        "Blocked account ~€11,904/year (verify current amount on embassy site)",
                        "Alternative: DAAD scholarship letter or German sponsor (Verpflichtungserklärung)",
                        "Start saving bank documentation now",
                    ],
                ),
            ],
        },
        {
            "phase": 4,
            "title": "Visa, blocked account & departure",
            "timeline": "Months 9–12",
            "description": "Complete visa and enrollment after receiving Zulassung.",
            "steps": [
                "Receive Zulassung and open blocked account.",
                "Book visa at German Embassy / VFS.",
                "Enroll and arrange housing.",
            ],
            "stepDetails": [
                _step(
                    "Receive admission (Zulassung)",
                    "Note enrollment deadline on the letter.",
                    [
                        "Download Zulassung PDF immediately from portal",
                        "Pay semester contribution before Immatrikulation deadline",
                        "Submit any conditional documents before deadline",
                    ],
                ),
                _step(
                    "Open blocked bank account (Sperrkonto)",
                    "Required unless full DAAD scholarship covers living costs.",
                    [
                        "Compare Fintiba and Expatrio — both embassy-recognized",
                        "Transfer blocked amount (~€11,904 + fees)",
                        "Download Sperrbestätigung for visa file",
                    ],
                    "https://www.fintiba.com/",
                ),
                _step(
                    "Apply for national student visa (Type D)",
                    "German Embassy Islamabad or VFS Global.",
                    [
                        "Book at pakistan.diplo.de → National visa → Study",
                        "Documents: passport, photos, Zulassung, APS, blocked account, insurance, CV",
                        "Processing 4–12 weeks; do not book flights until approved",
                    ],
                    "https://pakistan.diplo.de/pk-en/service/visa-visa",
                ),
                _step(
                    "Pre-departure checklist",
                    "Final steps before flying.",
                    [
                        "Travel health insurance from arrival date",
                        "Temporary housing via Studierendenwerk or WG-gesucht.de",
                        "Complete Immatrikulation online before semester start",
                        "Bring originals of all uploaded documents",
                    ],
                ),
            ],
        },
    ]


def build_detailed_roadmap(profile: dict) -> dict:
    countries = profile.get("countries") or profile.get("preferred_countries") or ["Germany"]
    country_str = ", ".join(countries[:3])
    target = profile.get("target_degree") or "Masters"
    major = profile.get("major") or "Computer Science"

    phases = _germany_masters_phases(profile) if "Germany" in countries else _germany_masters_phases(profile)

    return {
        "title": f"{target} in {country_str} — Step-by-Step Plan ({major})",
        "overallTimeline": "12-month preparation roadmap with actionable details",
        "phases": phases,
    }


# Backward-compatible alias
build_detailed_manual_roadmap = build_detailed_roadmap
