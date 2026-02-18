// 图片压缩配置
const MAX_WIDTH = 800
const MAX_HEIGHT = 800
const QUALITY = 0.6
const MAX_SIZE_KB = 100

export interface CompressedImage {
  base64: string      // data:image/jpeg;base64,...
  width: number
  height: number
  sizeKB: number
}

export async function compressImage(file: File): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // 计算缩放
      let { width, height } = img
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      // 绘制
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      // 压缩
      let quality = QUALITY
      let base64 = canvas.toDataURL('image/jpeg', quality)
      let sizeKB = base64.length / 1024

      // 如果还太大，继续降低质量
      while (sizeKB > MAX_SIZE_KB && quality > 0.1) {
        quality -= 0.1
        base64 = canvas.toDataURL('image/jpeg', quality)
        sizeKB = base64.length / 1024
      }

      resolve({ base64, width, height, sizeKB })
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export async function compressMultiple(files: File[]): Promise<CompressedImage[]> {
  const results = await Promise.all(files.map(f => compressImage(f)))
  return results
}

// 提取 base64 数据（去掉 data:image/...;base64, 前缀）
export function extractBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] || dataUrl
}
