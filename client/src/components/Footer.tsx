import { Link } from "wouter";
import { Sprout, Mail, Clock, MessageCircle } from "lucide-react";
import ExternalLink from "./ExternalLink";

function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 text-white pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Column 1 */}
          <div>
            <h3 className="font-montserrat font-bold text-xl mb-4 flex items-center">
              <Sprout className="h-6 w-6 mr-2 text-secondary" />
              <span>Jungle Plants</span>
            </h3>
            <p className="text-gray-300 mb-4">Превращаем ваш дом в уютные джунгли с 2020 года</p>
            <div className="flex space-x-3">
              <ExternalLink href="https://t.me/helen_heinlein" className="text-white hover:text-secondary transition-colors">
                <i className="ri-telegram-fill text-xl"></i>
              </ExternalLink>
              <ExternalLink href="https://instagram.com/jungle_plants" className="text-white hover:text-secondary transition-colors">
                <i className="ri-instagram-fill text-xl"></i>
              </ExternalLink>
              <ExternalLink href="mailto:info@jungleplants.ru" className="text-white hover:text-secondary transition-colors">
                <i className="ri-mail-fill text-xl"></i>
              </ExternalLink>
            </div>
          </div>
          
          {/* Column 2 */}
          <div>
            <h3 className="font-montserrat font-bold text-lg mb-4">Информация</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-gray-300 hover:text-white transition-colors">
                  О нас
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-300 hover:text-white transition-colors">
                  Доставка и оплата
                </Link>
              </li>
              <li>
                <Link href="/care" className="text-gray-300 hover:text-white transition-colors">
                  Уход за растениями
                </Link>
              </li>
              <li>
                <ExternalLink href="https://telegra.ph/CHasto-zadavaemye-voprosy-o-Dzhunglevom-bote-i-zakupke-07-15" className="text-gray-300 hover:text-white transition-colors">
                  FAQ
                </ExternalLink>
              </li>
              <li>
                <ExternalLink href="https://t.me/junglefeedback" className="text-gray-300 hover:text-white transition-colors">
                  Отзывы
                </ExternalLink>
              </li>
            </ul>
          </div>
          
          {/* Column 3 */}
          <div>
            <h3 className="font-montserrat font-bold text-lg mb-4">Каталог</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/catalog" className="text-gray-300 hover:text-white transition-colors">
                  Все растения
                </Link>
              </li>
              <li>
                <Link href="/catalog?category=rare" className="text-gray-300 hover:text-white transition-colors">
                  Редкие виды
                </Link>
              </li>
              <li>
                <Link href="/catalog?available=true" className="text-gray-300 hover:text-white transition-colors">
                  Растения в наличии
                </Link>
              </li>
              <li>
                <Link href="/catalog?preorder=true" className="text-gray-300 hover:text-white transition-colors">
                  Предзаказ
                </Link>
              </li>
              <li>
                <Link href="/catalog?discount=true" className="text-gray-300 hover:text-white transition-colors">
                  Распродажа
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Column 4 */}
          <div>
            <h3 className="font-montserrat font-bold text-lg mb-4">Контакты</h3>
            <ul className="space-y-2">
              <li className="flex items-center">
                <MessageCircle className="h-5 w-5 mr-2" />
                <ExternalLink href="https://t.me/helen_heinlein" className="text-gray-300 hover:text-white transition-colors">
                  @helen_heinlein
                </ExternalLink>
              </li>
              <li className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                <ExternalLink href="mailto:info@jungleplants.ru" className="text-gray-300 hover:text-white transition-colors">
                  info@jungleplants.ru
                </ExternalLink>
              </li>
              <li className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                <span className="text-gray-300">Пн-Пт: 10:00 - 19:00</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-700 pt-6 text-center text-gray-400 text-sm">
          <p>© {new Date().getFullYear()} Jungle Plants. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
