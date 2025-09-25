import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileDown, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  onExportPDF: () => void;
  onExportCSV: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
}

export function ExportButton({
  onExportPDF,
  onExportCSV,
  isLoading = false,
  disabled = false,
  label = 'Export'
}: ExportButtonProps) {
  const [exporting, setExporting] = useState<boolean>(false);

  const handleExport = async (callback: () => void) => {
    try {
      setExporting(true);
      await callback();
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isLoading || exporting}
          className="ml-auto h-8 gap-1"
        >
          {isLoading || exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          <span>{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleExport(onExportPDF)}
          disabled={isLoading || exporting}
        >
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport(onExportCSV)}
          disabled={isLoading || exporting}
        >
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}