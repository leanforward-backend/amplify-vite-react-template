import OpenAI from "openai";
import { PDFParse } from 'pdf-parse';
import { useState } from "react";

PDFParse.setWorker('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs');

interface Transaction {
    data: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
}

export const PdfUpload = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleDrop = async (evt: React.DragEvent) => {
        evt.preventDefault();
        setIsDragging(false);

        const file = evt.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            await processPdf(file);
        } else {
            setError('Please upload a valid PDF file');
        }
    };

    const handleFileInput = async (evt: React.ChangeEvent<HTMLInputElement>) => {
        const file = evt.target.files?.[0];
        if (file) {
            await processPdf(file);
        }
    }

    const processPdf = async (file: File) => {
        setLoading(true);
        setError(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
            const result = await parser.getText();
            const pdfText = result.text;

            if (!pdfText || pdfText.trim().length === 0) {
                throw new Error('Could not extract text from PDF. The PDF might be image-based or encrypted.');
            }

            const openai = new OpenAI({
                apiKey: import.meta.env.VITE_OPENAI_API_KEY,
                dangerouslyAllowBrowser: true // Only OK for testing!
            });

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: `Extract all transactions from this bank statement text. 
                Return ONLY a JSON array with this exact format:
                [{"date": "YYYY-MM-DD", "description": "string", "amount": number, "type": "income" or "expense"}]
                
                Rules:
                - Positive amounts or deposits are "income"
                - Negative amounts or withdrawals are "expense"  
                - Amount should always be positive number
                - Return valid JSON only, no markdown or explanation
                
                Bank statement text:
                ${pdfText}`
                    }
                ],
                max_tokens: 4096
            });

            const content = response.choices[0].message.content;
            if (content) {
                const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
                const parsed = JSON.parse(cleanedContent);
                setTransactions(parsed);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process PDF');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>Upload Bank Statement</h2>

            <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                style={{
                    border: `2px dashed ${isDragging ? '#0066cc' : '#ccc'}`,
                    borderRadius: '8px',
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: isDragging ? '#f0f8ff' : '#fafafa',
                    cursor: 'pointer',
                    marginBottom: '20px'
                }}
            >
                <p>Drag and drop your bank statement PDF here</p>
                <p style={{ color: '#666', fontSize: '14px' }}>or</p>
                <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                    id="file-input"
                />
                <label htmlFor="file-input" style={{
                    padding: '10px 20px',
                    backgroundColor: '#0066cc',
                    color: 'white',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-block'
                }}>
                    Choose File
                </label>
            </div>

            {loading && (
                <p style={{ textAlign: 'center', fontSize: '18px' }}>
                    🔄 Processing PDF with OpenAI...
                </p>
            )}

            {error && (
                <p style={{ color: 'red', padding: '10px', backgroundColor: '#ffe6e6', borderRadius: '4px' }}>
                    ❌ {error}
                </p>
            )}

            {transactions.length > 0 && (
                <div>
                    <h3>Extracted Transactions ({transactions.length})</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f0f0f0' }}>
                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Date</th>
                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Description</th>
                                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Amount</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((t, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px' }}>{t.data}</td>
                                    <td style={{ padding: '12px' }}>{t.description}</td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                        ${t.amount.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            backgroundColor: t.type === 'income' ? '#d4edda' : '#f8d7da',
                                            color: t.type === 'income' ? '#155724' : '#721c24'
                                        }}>
                                            {t.type}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};