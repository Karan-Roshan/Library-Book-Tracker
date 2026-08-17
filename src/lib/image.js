// Reads a chosen photo into something small enough to store.

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const AVATAR_SIZE = 256

export class ImageError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ImageError'
  }
}

// Reads a chosen photo, shrinks it, and returns it small enough to store.
export function readAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new ImageError('Choose an image file (JPG, PNG, or WebP).'))
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new ImageError('That image is over 8 MB. Choose a smaller one.'))
      return
    }

    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = AVATAR_SIZE
        canvas.height = AVATAR_SIZE
        const context = canvas.getContext('2d')

        const side = Math.min(image.width, image.height)
        context.drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          AVATAR_SIZE,
          AVATAR_SIZE,
        )
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch {
        reject(new ImageError('That image could not be processed.'))
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ImageError('That file could not be read as an image.'))
    }

    image.src = url
  })
}
