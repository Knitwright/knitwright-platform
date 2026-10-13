/** Each studio page rises into place when it opens. The framework draws this afresh per page. */
export default function StudioTemplate({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="rise">{children}</div>;
}
