# python-extractor/app.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import fitz  # PyMuPDF
from unstructured.partition.pdf import partition_pdf
from typing import List, Dict, Any
from io import BytesIO
import re
import os
import traceback

from sentence_transformers import SentenceTransformer
import numpy as np

app = FastAPI()

EMBED_MODEL_NAME = os.getenv("EMBED_MODEL_NAME", "intfloat/e5-base-v2")
try:
    _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
except Exception as e:
    print("[EMBEDDING INIT ERROR]", str(e))
    traceback.print_exc()
    _embed_model = None

HEADING_RE = re.compile(
    r"^(abstract|introduction|related work|background|method|methods|methodology|experiments?|results?|discussion|conclusion|acknowledg(e)?ments?|references?)$",
    re.I
)

def detect_block_type(element) -> str:
    t = getattr(element, "category", None) or element.__class__.__name__
    if "Title" in t or "Header" in t:
        return "heading"
    if "Table" in t:
        return "table"
    if "Figure" in t or "Image" in t:
        return "figure"
    text = (getattr(element, "text", None) or str(element)).strip()
    if re.search(r"(Equation|Eq\.|\b∑|∂|∫|≈|≤|≥|≠|±|√|→|∀|∃|∇)", text):
        return "equation"
    return "paragraph"

def extract_blocks_pdf(file_bytes: bytes) -> List[Dict[str, Any]]:
    _ = fitz.open(stream=file_bytes, filetype="pdf")  # validate pdf
    elements = partition_pdf(file=BytesIO(file_bytes), strategy="hi_res")
    blocks = []
    current_section = None
    for e in elements:
        text = (getattr(e, "text", None) or "").strip()
        if not text:
            continue
        btype = detect_block_type(e)
        meta = {
            "type": btype,
            "page_number": getattr(e, "metadata", {}).get("page_number", None) or 1,
            "text": text
        }
        if btype == "heading":
            low = text.lower().strip(": ").strip()
            current_section = (low.capitalize() if HEADING_RE.match(low) else text.strip())
            meta["section"] = current_section
            blocks.append(meta)
            continue
        if current_section:
            meta["section"] = current_section
        caption = getattr(e, "metadata", {}).get("text_as_html", None)
        if caption and (btype in ["figure", "table"]):
            meta["caption_html"] = caption
        blocks.append(meta)
    return blocks

@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    content = await file.read()
    try:
        blocks = extract_blocks_pdf(content)
        return JSONResponse({"blocks": blocks})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"extract failed: {str(e)}")

class EmbedPayload(BaseModel):
    texts: List[str]

@app.post("/embed")
async def embed(payload: EmbedPayload):
    try:
        if _embed_model is None:
            raise RuntimeError("embedding model was not initialized")
        texts = payload.texts
        if not isinstance(texts, list) or not texts:
            raise HTTPException(status_code=400, detail="texts must be a non-empty list")
        vecs = _embed_model.encode(
            texts, convert_to_numpy=True, normalize_embeddings=True
        )
        return JSONResponse({"embeddings": vecs.tolist(), "model": EMBED_MODEL_NAME})
    except HTTPException:
        raise
    except Exception as e:
        # Trả về body chi tiết để TS log ra
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"embed failed: {str(e)}")

@app.get("/ping")
async def ping():
    return {"ok": True, "model": EMBED_MODEL_NAME}
