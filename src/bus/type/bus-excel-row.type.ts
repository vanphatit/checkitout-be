export interface BusExcelRow {
  busNo: string;
  plateNo: string;
  type: string;
  vacancy: number | string;
  driverName: string;
  status?: 'AVAILABLE' | 'UNAVAILABLE';
  images?: string[];
}
