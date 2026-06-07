// shadcn 风格 cn 工具：合并 className，自动去重 Tailwind 冲突类
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 className：先 clsx 处理条件类，再 twMerge 解决 Tailwind 类冲突
 * @param inputs 任意 className 输入（string / array / object）
 * @returns 合并后的 className 字符串
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
