export async function compressImage(file, maxSizeKB = 100) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let quality = 0.9;
        let scale = 1;
        const maxIter = 10;
        let iter = 0;
        const targetBytes = maxSizeKB * 1024;
        
        // Initial resolution reduction if image is very large
        if (img.width > 2000 || img.height > 2000) {
          scale = 2000 / Math.max(img.width, img.height);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const tryCompress = () => {
          iter++;
          canvas.width = Math.floor(img.width * scale);
          canvas.height = Math.floor(img.height * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          // length of base64 string is roughly 4/3 of bytes
          const bytes = Math.round(dataUrl.length * 0.75);

          if (bytes <= targetBytes || iter >= maxIter || (scale <= 0.2 && quality <= 0.3)) {
            resolve(dataUrl); // returns base64
          } else {
            // Adjust scale and quality
            if (bytes > targetBytes * 2) {
              scale *= 0.8;
            } else {
              quality -= 0.15;
            }
            tryCompress();
          }
        };
        tryCompress();
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
