/// <reference types="react" />
interface CollapsibleProps {
    label: React.ReactNode;
    open: boolean;
    openTrigger: () => void;
    children: React.ReactNode;
    className?: string;
}
declare const Collapsible: ({ label, open, openTrigger, children, className, }: CollapsibleProps) => JSX.Element;
export default Collapsible;
