import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

const ImportLoadingState = () => {
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    'Buscando anúncio no Airbnb...',
    'Extraindo informações da propriedade...',
    'Processando dados...',
    'Quase lá...'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % steps.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="p-6 mb-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 py-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-foreground animate-pulse">
            {steps[currentStep]}
          </span>
        </div>

        <div className="space-y-3 animate-pulse">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 bg-primary/20" />
              <Skeleton className="h-10 w-full bg-primary/10" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 bg-primary/20" />
              <Skeleton className="h-10 w-full bg-primary/10" />
            </div>
          </div>
          
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 bg-primary/20" />
            <Skeleton className="h-10 w-full bg-primary/10" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 bg-primary/20" />
              <Skeleton className="h-10 w-full bg-primary/10" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 bg-primary/20" />
              <Skeleton className="h-10 w-full bg-primary/10" />
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Isso pode levar alguns segundos...
        </p>
      </div>
    </Card>
  );
};

export default ImportLoadingState;
