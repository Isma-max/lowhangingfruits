import Foundation

/// RFC 4180-ish CSV field escaping (quote if the field contains a comma,
/// quote, or newline; double any embedded quotes). Rows are joined with CRLF,
/// which is the RFC 4180 line ending and opens cleanly in Excel/Numbers/Sheets.
public enum CSVFormatting {
    public static func field(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") {
            return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return value
    }

    public static func field(_ value: Double) -> String { String(value) }
    public static func field(_ value: Int) -> String { String(value) }
    public static func field(_ value: Bool) -> String { value ? "true" : "false" }

    public static func optionalField(_ value: Double?) -> String { value.map { String($0) } ?? "" }
    public static func optionalField(_ value: Int?) -> String { value.map { String($0) } ?? "" }
    public static func optionalField(_ value: String?) -> String { value.map(field) ?? "" }

    public static func row(_ fields: [String]) -> String { fields.joined(separator: ",") }
}

/// Conformers declare their own fixed column order — deliberately not a
/// generic `Encodable`-driven reflection scheme, so the exported schema is
/// explicit, stable, and documented (brief priority #2: trazabilidad).
public protocol CSVRepresentable {
    static var csvHeader: [String] { get }
    func csvFields() -> [String]
}

public enum CSVEncoder {
    public static func encode<T: CSVRepresentable>(_ records: [T]) -> String {
        var lines = [CSVFormatting.row(T.csvHeader)]
        lines.append(contentsOf: records.map { CSVFormatting.row($0.csvFields()) })
        return lines.joined(separator: "\r\n") + "\r\n"
    }
}
