import React from 'react';

// Интерфейс пропсов компонента
interface ExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

/**
 * Компонент внешней ссылки, который корректно обрабатывает переходы на внешние ресурсы
 * вместо использования History API
 */
const ExternalLink = ({ href, children, ...props }: ExternalLinkProps) => {
  // Функция для обработки клика
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Если есть обработчик клика в пропсах, вызываем его
    if (props.onClick) {
      props.onClick(e);
    }
    
    // Если ссылка из категории внешних, то открываем в новой вкладке
    // и предотвращаем срабатывание роутера
    const isExternalLink = 
      href.startsWith('http://') || 
      href.startsWith('https://') || 
      href.startsWith('mailto:') || 
      href.startsWith('tel:');
      
    if (isExternalLink && !props.target) {
      e.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <a 
      href={href}
      target={props.target || '_blank'} 
      rel={props.rel || 'noopener noreferrer'}
      {...props}
      onClick={handleClick}
    >
      {children}
    </a>
  );
};

export default ExternalLink; 