import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogActions } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddBudgetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (budget: { name: string; amount: number }) => void;
}

export const AddBudgetDialog: React.FC<AddBudgetDialogProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);

  const handleAdd = () => {
    onAdd({ name, amount });
    setName("");
    setAmount(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>Add Budget</DialogTitle>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Budget Name" />
        <Input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} placeholder="Amount" />
        <DialogActions>
          <Button onClick={handleAdd}>Add</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};
