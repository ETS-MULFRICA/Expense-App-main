import React from "react"; 
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
        {/* Replace DialogActions with a div */}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="destructive" onClick={onDelete}>Delete</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
