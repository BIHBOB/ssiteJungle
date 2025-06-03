import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Компонент для автоматической прокрутки страницы вверх при навигации
 */
export default function ScrollToTop() {
  // Получаем текущий путь из wouter
  const [location] = useLocation();
  
  // При изменении пути прокручиваем страницу вверх
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth' // для плавной прокрутки
    });
  }, [location]);
  
  // Компонент не рендерит ничего видимого
  return null;
} 