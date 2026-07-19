# Project Bibliography & Grounding References

This document records the academic and scientific references used as the authoritative ground-truth corpus for the **Dó.AI** interactive digital exhibition.

To preserve the historical and technical authenticity of the traditional Vietnamese Dó papermaking process and eliminate LLM generative hallucinations, all RAG knowledge chunks and conversational policies are strictly grounded in these verified references.

---

## 1. Core Reference Literature

### 📖 Primary Academic Source
* **Title:** Nghiên Cứu Về Giấy Dó *(Việt Nam's Paper Plants: Dó)*
* **Authors:** 
  * **James Ojascastro** (Botanist, USA)
  * **Veronica Y. Pham** (Researcher, USA)
  * **Tran Hong Nhung** (Researcher, Vietnam)
  * **Robie Hart** (William L. Brown Center, Missouri Botanical Garden, USA)
* **Source artifact:** The 131.46 MB academic PDF is retained locally under `docs/resources/` and intentionally excluded from Git because it exceeds GitHub's 100 MB file limit.
* **Scope of Ingestion:** Standardized botanical identification, raw material preparation steps (peeling, soaking, boiling, pounding), sheet formation techniques, drying methods, and historical applications in folklore painting (Dong Ho and Hang Trong).

---

## 2. Data Standard & Grounding Ingestion Workflow

To translate the primary literature into a clean, machine-readable format suitable for factual retrieval without semantic drift:
1. **Extraction:** Raw text was extracted from the academic PDF, and critical botanical and historical tables were cross-verified page-by-page against the source scanned images.
2. **Segmentation & Structuring:** The verified corpus was split into 10 structured, distinct steps corresponding to the process stations mapped in `content/approved/media/tay-ho-giay-do-room-01.json`.
3. **Factual Verification:** We cross-referenced data metrics (such as chemical temperatures, soaking durations, and fiber yields) to ensure the RAG knowledge-base chunks exactly represent peer-reviewed data.
