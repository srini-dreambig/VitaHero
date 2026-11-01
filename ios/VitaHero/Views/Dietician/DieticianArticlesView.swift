import SwiftUI

/// What a dietician writes for every family, not just one child.
///
/// An article written here is offered to families whose child was flagged on
/// growth or haemoglobin, the same scope this role reads. Editing somebody
/// else's article is refused by the server, and the refusal is shown as
/// written: it tells the author to change the title.
struct DieticianArticlesView: View {
    @EnvironmentObject private var dietician: DieticianStore

    @State private var writing = false
    @State private var title = ""
    @State private var summary = ""
    @State private var bodyText = ""
    @State private var locale = "en"
    @State private var busy = false
    @State private var message = ""

    private var canPublish: Bool {
        !busy && title.trimmingCharacters(in: .whitespacesAndNewlines).count >= 3
            && bodyText.trimmingCharacters(in: .whitespacesAndNewlines).count >= 40
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Shown to families whose child was flagged on growth or haemoglobin")
                    .font(.subheadline).foregroundColor(.secondary)
                if let error = dietician.articlesError { Banner(text: error, color: Brand.red) }
                if !message.isEmpty { Banner(text: message, color: Brand.red) }

                if writing { form } else { intro }

                if dietician.articles.isEmpty {
                    Text(dietician.articlesLoading ? "Loading…" : "You have not written anything yet.")
                        .font(.footnote).foregroundColor(.secondary)
                } else {
                    ForEach(dietician.articles) { article in
                        Button { edit(article) } label: { row(article) }
                            .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("What families read")
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
        .refreshable { await dietician.loadArticles() }
        .task { await dietician.loadArticles() }
    }

    private var intro: some View {
        Card {
            Text("Write something for everyone").font(.subheadline.weight(.semibold))
            Text("A plan is for one child. This is the advice that is the same for every family — what "
                 + "iron-rich food costs nothing, what a growing child's plate looks like.")
                .font(.footnote).foregroundColor(.secondary)
            PrimaryButton(title: "Write an article", enabled: !busy) { writing = true }
        }
    }

    private var form: some View {
        Card {
            TextFieldRow(label: "Title", value: $title)
            TextFieldRow(label: "One line, shown in the list", value: $summary)
            DieticianTextArea(label: "The article", text: $bodyText, minHeight: 180)
            Text("Language").font(.subheadline.weight(.semibold))
            HStack(spacing: 6) {
                ForEach(AppLanguage.allCases) { language in
                    DieticianChip(title: language.nativeName, selected: locale == language.rawValue) {
                        locale = language.rawValue
                    }
                }
            }
            // Said out loud because a family reading Telugu is shown the
            // English one when there is no Telugu version.
            Text("A family sees the version in their own language, or the English one if you have not written theirs.")
                .font(.footnote).foregroundColor(.secondary)
            PrimaryButton(title: busy ? "Publishing…" : "Publish", busy: busy, enabled: canPublish) {
                Task { await publish() }
            }
            Text("A title and a few sentences. Write it for a parent, not for a clinician.")
                .font(.footnote).foregroundColor(.secondary)
            Button("Cancel") { writing = false }
                .font(.subheadline)
                .foregroundColor(.secondary)
                .buttonStyle(.borderless)
        }
    }

    private func row(_ article: LibraryArticle) -> some View {
        let language = AppLanguage(rawValue: article.locale)?.nativeName ?? article.locale
        return Card {
            Text(article.title).font(.subheadline.weight(.semibold)).lineLimit(1)
            Text([language, article.published ? "" : "not published"].filter { !$0.isEmpty }
                .joined(separator: " · "))
                .font(.caption).foregroundColor(.secondary)
            if !article.summary.isEmpty {
                Text(article.summary).font(.footnote).lineLimit(2)
            }
        }
    }

    /// Open one of their own articles in the form, as Android does.
    private func edit(_ article: LibraryArticle) {
        title = article.title
        summary = article.summary
        bodyText = article.body
        locale = article.locale
        writing = true
    }

    private func publish() async {
        busy = true
        defer { busy = false }
        switch await dietician.saveArticle(title: title, summary: summary, body: bodyText, locale: locale) {
        case .success:
            message = ""
            writing = false
            title = ""; summary = ""; bodyText = ""
        case .failure(let error):
            message = clinicianMessage(error, fallback: "The article was not saved.")
        }
    }
}
