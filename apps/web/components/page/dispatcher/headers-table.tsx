"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface HeaderEntry {
  id: string;
  key: string;
  value: string;
}

interface HeadersTableProps {
  data: HeaderEntry[];
  onChange: (data: HeaderEntry[]) => void;
}

export function HeadersTable({ data, onChange }: HeadersTableProps) {
  const addRow = () => {
    onChange([
      ...data,
      {
        id: Math.random().toString(36).slice(2),
        key: "",
        value: "",
      },
    ]);
  };

  const removeRow = (id: string) => {
    onChange(data.filter((row) => row.id !== id));
  };

  const updateRow = (id: string, key: string, value: string) => {
    onChange(
      data.map((row) =>
        row.id === id
          ? { ...row, key: key || row.key, value: value || row.value }
          : row,
      ),
    );
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[#1a2235] bg-[#070b14]/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a2235] bg-[#0c1220]">
              <th className="px-4 py-3 text-left text-[10px] uppercase font-bold tracking-wider text-slate-500 w-1/3">
                Header Name
              </th>
              <th className="px-4 py-3 text-left text-[10px] uppercase font-bold tracking-wider text-slate-500 flex-1">
                Header Value
              </th>
              <th className="px-4 py-3 text-center text-[10px] uppercase font-bold tracking-wider text-slate-500 w-12">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-slate-600"
                >
                  <p className="text-sm">
                    No headers. Click "Add Header" to start.
                  </p>
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#1a2235] hover:bg-[#121828]/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Input
                      placeholder="e.g. User-Agent"
                      value={row.key}
                      onChange={(e) =>
                        updateRow(row.id, e.target.value, row.value)
                      }
                      className="bg-[#0c1220] border-[#1a2235] text-slate-200 h-10 rounded-lg text-xs"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      placeholder="e.g. Mozilla/5.0..."
                      value={row.value}
                      onChange={(e) =>
                        updateRow(row.id, row.key, e.target.value)
                      }
                      className="bg-[#0c1220] border-[#1a2235] text-slate-200 h-10 rounded-lg text-xs"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="p-2 hover:bg-rose-500/10 rounded-lg text-slate-600 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Button
        onClick={addRow}
        variant="outline"
        size="sm"
        className="w-full border-[#1a2235] bg-transparent hover:bg-indigo-500/10 hover:border-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg"
      >
        <Plus className="size-4 mr-2" /> Add Header
      </Button>
    </div>
  );
}
