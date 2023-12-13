import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// convert to ascii

export function convertToAscii(inputString: string) {
  // Replace non-printable ASCII characters and certain special characters
  const asciiString = inputString
      .replace(/[^ -~]/g, "") // Remove non-ASCII characters
      .replace(/[\s\/\\:;*?"<>|&'()@!#%^+`={}[\],.]/g, "_"); // Replace spaces and special characters with underscore

  return asciiString;
}
