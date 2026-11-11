#!/bin/sh
# Fetches the English text-recognition model (about 9 MB) used for the best accuracy.
set -e
cd "$(dirname "$0")"
mkdir -p models
curl -fsSL -o models/en_PP-OCRv3_rec_infer.onnx \
  https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv3/en_PP-OCRv3_rec_infer.onnx
curl -fsSL -o models/en_dict.txt \
  https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/release/2.7/ppocr/utils/en_dict.txt
echo "models downloaded:"; ls -l models
