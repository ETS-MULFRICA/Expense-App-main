import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogActions } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteBudgetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export const DeleteBudgetDialog: React.FC<DeleteBudgetDialogProps> = ({ isOpen, onClose, onDelete }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>Delete Budget</DialogTitle>
        <p>Are you sure you want to delete this budget?</p>
        <DialogActions>
          <Button variant="destructive" onClick={onDelete}>Delete</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};
