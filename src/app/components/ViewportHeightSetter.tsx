"use client";
import { useEffect } from 'react';

/**
 * 动态设置 CSS 变量 --vh = window.innerHeight * 0.01
 * 解决移动端浏览器地址栏导致 100vh 不准确的问题。
 * 用法：在 layout 中引入；然后使用 className="h-screen-dvh" 或 height: calc(var(--vh) * 100)
 */
export function ViewportHeightSetter() {
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);
  return null;
}
