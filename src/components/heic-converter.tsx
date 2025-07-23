'use client';

import { useState, useCallback } from 'react';
import type { FC, DragEvent } from 'react';
import { saveAs } from 'file-saver';
import { UploadCloud, File as FileIcon, CheckCircle2, XCircle, Loader } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

type ConversionStatus = 'converting' | 'complete' | 'error';

interface ConversionFile {
  id: string;
  file: File;
  status: ConversionStatus;
  error?: string;
}

const HEICConverter: FC = () => {
  const [files, setFiles] = useState<ConversionFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleConversion = useCallback(async (file: File) => {
    const fileId = `${file.name}-${file.lastModified}-${Math.random()}`;
    setFiles(prev => {
      if(prev.find(f => f.id.startsWith(`${file.name}-${file.lastModified}`))) {
        // Don't add duplicates if already processing
        return prev;
      }
      return [...prev, { id: fileId, file, status: 'converting' }];
    });

    try {
      const heic2any = (await import('heic2any')).default;
      const conversionResult = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.92,
      });

      const convertedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
      const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      saveAs(convertedBlob, `${originalName}.jpeg`);
      
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'complete' } : f));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'This file type may not be supported.';
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error', error: errorMessage } : f));
      toast({
        variant: "destructive",
        title: `Failed to convert ${file.name}`,
        description: errorMessage,
      });
    }
  }, [toast]);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const heicFiles = Array.from(selectedFiles).filter(file => file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic');

    if (heicFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No HEIC files found',
        description: 'Please select files with a .heic extension.'
      });
      return;
    }
    
    heicFiles.forEach(file => handleConversion(file));
  }

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFileSelect(event.dataTransfer.files);
  }, [handleConversion]);

  const renderStatusIcon = (status: ConversionStatus) => {
    switch (status) {
      case 'converting':
        return <Loader className="animate-spin h-5 w-5 text-muted-foreground" />;
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-3xl shadow-lg">
      <CardHeader className="text-center p-8">
        <CardTitle className="text-3xl font-bold tracking-tight">HEIC to JPEG Converter</CardTitle>
        <CardDescription className="text-lg text-muted-foreground pt-2">Drag and drop your HEIC files to convert them to JPEG instantly.</CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-8 space-y-6">
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-300",
            isDragging ? "border-primary bg-primary/10" : "border-accent hover:border-primary/50"
          )}
        >
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            multiple
            accept=".heic,image/heic"
            onChange={(e) => handleFileSelect(e.target.files)}
            id="file-upload"
          />
          <div className="text-center pointer-events-none">
            <UploadCloud className={cn("h-12 w-12 mx-auto", isDragging ? "text-primary" : "text-muted-foreground")} />
            <p className="mt-4 font-semibold text-foreground">
              {isDragging ? "Drop files to convert" : "Drag & drop files here"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
          </div>
        </div>
        {files.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold tracking-tight">Conversion Queue</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead className="w-[120px] text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map(({ id, file, status, error }) => (
                    <TableRow key={id}>
                      <TableCell className="font-medium flex items-center gap-3 py-4">
                        <FileIcon className="h-6 w-6 text-muted-foreground flex-shrink-0"/>
                        <span className="truncate" title={file.name}>{file.name}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {renderStatusIcon(status)}
                          <span className="capitalize font-medium">{status === 'error' ? 'Error' : status}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {files.some(f => f.status === 'complete' || f.status === 'error') && (
               <Button variant="outline" onClick={() => setFiles([])} className="w-full">
                Clear Completed
               </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HEICConverter;
