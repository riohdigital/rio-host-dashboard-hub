
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KPICardProps {
  title: string;
  value: string;
  isPositive?: boolean;
  icon?: React.ReactNode;
}

const KPICard = ({ title, value, isPositive = true, icon }: KPICardProps) => {
  return (
    <Card className="bg-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-[#374151]">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-[#6A6DDF]">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${
          isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
        }`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
};

export default KPICard;
