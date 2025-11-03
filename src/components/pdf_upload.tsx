import OpenAI from "openai";
import Papa from 'papaparse';
import { PDFParse } from 'pdf-parse';
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";


PDFParse.setWorker('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs');

interface Transaction {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
}

export const PdfUpload = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');


    const processCSV = async (file: File) => {
        return new Promise<Transaction[]>((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        if (results.data.length > 0) {
                            console.log('CSV Column names:', Object.keys(results.data[0] as object));
                            console.log('First row sample:', results.data[0]);
                        }

                        const transactions: Transaction[] = results.data.map((row: any) => {
                            const date = row.Date || row.date || row.TransactionDate || row['Transaction Date']
                                || row['Posting Date'] || row['Post Date'] || row.DATE;

                            const description = row.Narrative || row.Description || row.description || row.Memo || row.memo
                                || row.Details || row.details || row.Payee || row.payee || row.DESCRIPTION;

                            let amount = 0;
                            let isExpense = false;

                            const debitAmount = row['Debit Amount'];
                            const creditAmount = row['Credit Amount'];

                            if (debitAmount !== undefined && debitAmount !== null && debitAmount !== 0) {
                                amount = parseFloat(debitAmount);
                                isExpense = true;
                            } else if (creditAmount !== undefined && creditAmount !== null && creditAmount !== 0) {
                                amount = parseFloat(creditAmount);
                                isExpense = false;
                            }
                            else if (row.Amount !== undefined && row.Amount !== null) {
                                amount = parseFloat(row.Amount);
                            } else if (row.amount !== undefined && row.amount !== null) {
                                amount = parseFloat(row.amount);
                            } else if (row.AMOUNT !== undefined && row.AMOUNT !== null) {
                                amount = parseFloat(row.AMOUNT);
                            }
                            else if (row.Debit !== undefined || row.Credit !== undefined) {
                                amount = parseFloat(row.Debit || row.Credit || 0);
                                isExpense = row.Debit !== undefined;
                            } else if (row.debit !== undefined || row.credit !== undefined) {
                                amount = parseFloat(row.debit || row.credit || 0);
                                isExpense = row.debit !== undefined;
                            }
                            else if (row.Withdrawal !== undefined || row.Deposit !== undefined) {
                                amount = parseFloat(row.Withdrawal || row.Deposit || 0);
                                isExpense = row.Withdrawal !== undefined;
                            } else if (row.withdrawal !== undefined || row.deposit !== undefined) {
                                amount = parseFloat(row.withdrawal || row.deposit || 0);
                                isExpense = row.withdrawal !== undefined;
                            }

                            if (amount === 0) {
                                console.warn('Could not find amount in row:', row);
                            }

                            if (amount < 0) {
                                isExpense = true;
                            }

                            return {
                                date: date,
                                description: description,
                                amount: Math.abs(amount),
                                type: isExpense ? 'expense' : 'income'
                            };
                        });

                        resolve(transactions);
                    } catch (err) {
                        reject(new Error('Failed to parse CSV data. Please check the file format.'));
                    }
                },
                error: (error) => {
                    reject(new Error(`CSV parsing error: ${error.message}`));
                }
            });
        });
    };


    const processPdf = async (file: File): Promise<Transaction[]> => {
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

        if (!content) {
            throw new Error('No content returned from OpenAI. Please try again.');
        }

        const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
        const parsed = JSON.parse(cleanedContent) as Transaction[];
        return parsed;
    };

    const processFile = async (file: File) => {
        setLoading(true);
        setError(null);
        setFileName(file.name);

        try {
            let extractedTransactions: Transaction[];

            if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                extractedTransactions = await processCSV(file);
            } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                extractedTransactions = await processPdf(file);
            } else {
                throw new Error('Unsupported file type. Please upload a PDF or CSV file.');
            }

            setTransactions(extractedTransactions);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process file');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            processFile(acceptedFiles[0]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'text/csv': ['.csv']
        },
        multiple: false,
    });

    return (
        <div style={{ padding: '20px' }}>
            <h2>Upload Bank Statement</h2>

            <div
                {...getRootProps()}
                style={{
                    border: `2px dashed ${isDragActive ? '#0066cc' : '#ccc'}`,
                    borderRadius: '8px',
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: isDragActive ? '#f0f8ff' : '#fafafa',
                    cursor: 'pointer',
                    marginBottom: '20px',
                    transition: 'all 0.2s ease'
                }}
            >
                <input {...getInputProps()} />
                {isDragActive ? (
                    <p style={{ fontSize: '18px', color: '#0066cc' }}>📂 Drop your file here...</p>
                ) : (
                    <>
                        <p style={{ fontSize: '18px', marginBottom: '10px' }}>
                            📄 Drag and drop your bank statement here
                        </p>
                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
                            or click to browse
                        </p>
                        <p style={{ color: '#999', fontSize: '12px' }}>
                            Supports CSV (recommended) and PDF files
                        </p>
                    </>
                )}
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p style={{ fontSize: '18px' }}>
                        {fileName.endsWith('.csv') ? '📊 Parsing CSV...' : '🔄 Processing PDF with OpenAI...'}
                    </p>
                </div>
            )}

            {error && (
                <div style={{
                    color: '#721c24',
                    padding: '15px',
                    backgroundColor: '#f8d7da',
                    borderRadius: '4px',
                    border: '1px solid #f5c6cb',
                    marginBottom: '20px'
                }}>
                    ❌ {error}
                </div>
            )}

            {transactions.length > 0 && (
                <div>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '20px'
                    }}>
                        <h3 style={{ margin: 0 }}>
                            Extracted Transactions ({transactions.length})
                        </h3>
                        <span style={{ color: '#666', fontSize: '14px' }}>
                            from {fileName}
                        </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa' }}>
                                    <th style={{
                                        padding: '12px',
                                        textAlign: 'left',
                                        borderBottom: '2px solid #dee2e6',
                                        fontWeight: '600'
                                    }}>
                                        Date
                                    </th>
                                    <th style={{
                                        padding: '12px',
                                        textAlign: 'left',
                                        borderBottom: '2px solid #dee2e6',
                                        fontWeight: '600'
                                    }}>
                                        Description
                                    </th>
                                    <th style={{
                                        padding: '12px',
                                        textAlign: 'right',
                                        borderBottom: '2px solid #dee2e6',
                                        fontWeight: '600'
                                    }}>
                                        Amount
                                    </th>
                                    <th style={{
                                        padding: '12px',
                                        textAlign: 'center',
                                        borderBottom: '2px solid #dee2e6',
                                        fontWeight: '600'
                                    }}>
                                        Type
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((t, i) => (
                                    <tr
                                        key={i}
                                        style={{
                                            borderBottom: '1px solid #dee2e6',
                                            backgroundColor: i % 2 === 0 ? 'white' : '#f8f9fa'
                                        }}
                                    >
                                        <td style={{ padding: '12px' }}>{t.date}</td>
                                        <td style={{ padding: '12px' }}>{t.description}</td>
                                        <td style={{
                                            padding: '12px',
                                            textAlign: 'right',
                                            fontWeight: '600',
                                            fontFamily: 'monospace'
                                        }}>
                                            ${typeof t.amount === 'number' ? t.amount.toFixed(2) : '0.00'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: '600',
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
                </div>
            )}
        </div>
    );
};