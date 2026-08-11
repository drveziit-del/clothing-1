'use client';

interface ExportCsvButtonProps {
  data: any[];
  fileName?: string;
  className?: string;
}

export default function ExportCsvButton({
  data,
  fileName = 'export.csv',
  className = 'btn btn-secondary btn-sm',
}: ExportCsvButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) return;

    // 1. Extract keys from first item as headers
    const headers = Object.keys(data[0]);

    // 2. Generate CSV header row
    const csvRows = [headers.join(',')];

    // 3. Generate CSV data rows
    for (const row of data) {
      const values = headers.map((header) => {
        const val = row[header];
        // Format to string, sanitize potential formula characters, escape double quotes
        const strVal = String(val ?? '');
        const sanitized = /^[=+\-@\t\r]/.test(strVal) ? `'${strVal}` : strVal;
        const escaped = sanitized.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    // 4. Create Blob and trigger download
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className={className}
      disabled={!data || data.length === 0}
      type="button"
    >
      Export to CSV
    </button>
  );
}
