#!/bin/sh
# Fetches the English text-recognition model (about 9 MB) used for the best accuracy.
set -e
cd "$(dirname "$0")"
mkdir -p models
curl -fsSL -o models/en_PP-OCRv3_rec_infer.onnx \
  https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv3/en_PP-OCRv3_rec_infer.onnx
curl -fsSL -o models/en_dict.txt \
  https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/release/2.7/ppocr/utils/en_dict.txt

# Light recognition model (PP-OCR v2, ~2 MB) for servers whose CPU has no AVX, where the accurate model
# takes ~0.7 s per text line instead of ~0.03 s. Same file name so OCR_MODEL_DIR=/app/models-light just works;
# it must be run with OCR_REC_HEIGHT=32. Measured on the 18 real test photos: 192/197 fields (97%) vs 197/197.
mkdir -p models-light
curl -fsSL -o models-light/en_PP-OCRv3_rec_infer.onnx \
  https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv1/en_number_mobile_v2.0_rec_infer.onnx
cp models/en_dict.txt models-light/en_dict.txt
echo "models downloaded:"; ls -l models models-light
