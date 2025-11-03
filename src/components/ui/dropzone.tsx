import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { useDropzone, type DropzoneOptions } from "react-dropzone";
import { Card } from "./card";

interface DropZoneProps extends Omit<DropzoneOptions, 'onDrop'> {
    onDrop: (files: File[]) => void;
    description?: string;
    acceptedFormats?: string;
}

export const DropZone = ({
    onDrop,
    description = "Drag and drop your file here",
    acceptedFormats = "Supports CSV and PDF files",
    ...dropzoneOptions
}: DropZoneProps) => {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        ...dropzoneOptions
    });

    return (
        <Card
            {...getRootProps()}
            className={cn(
                "border-2 border-dashed cursor-pointer transition-all duration-100",
                "hover:border-primary/50 hover:bg-accent/50",
                isDragActive && "border-primary bg-accent"
            )}
        >
            <input {...getInputProps()} />
            <div className="p-10 text-center">
                {isDragActive ? (
                    <div className="flex flex-col items-center gap-2">
                        <Upload className="h-12 w-12 text-primary animate-pulse" />
                        <p className="text-lg font-medium">Drop your file here...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <Upload className="h-12 w-12 text-muted-foreground" />
                        <p className="text-lg font-medium">{description}</p>
                        <p className="text-sm text-muted-foreground">or click to browse</p>
                        <p className="text-xs text-muted-foreground mt-2">{acceptedFormats}</p>
                    </div>
                )}
            </div>
        </Card>
    );
};