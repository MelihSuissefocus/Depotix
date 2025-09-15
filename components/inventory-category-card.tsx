import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";


export const InventoryByCategory: React.FC<InventoryByCategoryProps> = ({
  categories,
  inventoryItems,
}) => {
  const { t, formatCurrency } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.inventoryByCategory')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => {
            const categoryItems = inventoryItems.filter(
              (item) => item.category === category.id
            );
            const categoryValue = categoryItems.reduce(
              (sum, item) => sum + Number(item.price) * (item.available_qty ?? 0),
              0
            );

            return (
              <Card key={category.id} className="overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">{category.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-500">{t('dashboard.items')}</p>
                      <p className="font-medium">{categoryItems.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('dashboard.value')}</p>
                      <p className="font-medium">
                        {formatCurrency(categoryValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('dashboard.quantity')}</p>
                      <p className="font-medium">
                        {categoryItems.reduce(
                          (sum, item) => sum + (item.available_qty ?? 0),
                          0
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {categories.length === 0 && (
            <div className="col-span-full text-center py-4 text-gray-500">
              {t('dashboard.noCategories')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};