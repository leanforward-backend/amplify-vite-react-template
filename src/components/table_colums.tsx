"use client"
import { ColumnDef } from "@tanstack/react-table";

export type Transactions = {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
}

export const columns: ColumnDef<Transactions>[] = [
    {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => {
            return <div className="font-medium">{row.getValue("date")}</div>
        },
    },
    {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
            return <div className="max-w-[500px] truncate">{row.getValue("description")}</div>
        },
    },
    {
        accessorKey: "amount",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("amount"))
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
            }).format(amount)
            return <div className="text-right font-medium">{formatted}</div>
        },
    },
    {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
            const type = row.getValue("type") as string
            return (
                <div className="flex items-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${type === 'income'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                        {type}
                    </span>
                </div>
            )
        },
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        },
    },
]