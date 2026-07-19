/**
 * Hardcoded data for the Vietnamese Dó Paper Museum Guide & Exhibits.
 * Structured to be easily replaceable with an AI/RAG backend later.
 */

// General topics about Dó Paper (for "Tìm hiểu về giấy dó" menu option)
export const GUIDE_GENERAL_TOPICS = [
  {
    id: "giay_do_la_gi",
    title: "Giấy dó là gì?",
    content: "Giấy dó là một loại giấy thủ công truyền thống của Việt Nam, được làm chủ yếu từ phần xơ bên trong vỏ cây dó. Giấy có bề mặt tự nhiên, nhẹ, dai và mang những đường vân đặc trưng do quá trình xeo hoàn toàn bằng tay. Đây là chất liệu từng được sử dụng phổ biến trong sách cổ, thư pháp, tranh dân gian, văn bản hành chính và các hoạt động tín ngưỡng."
  },
  {
    id: "nguyen_lieu",
    title: "Nguyên liệu làm giấy",
    content: "Nguyên liệu chính là vỏ cây dó đã được bóc và xử lý để lấy phần xơ bên trong. Tùy từng vùng và kỹ thuật của người thợ, bột giấy có thể được pha cùng chất kết dính tự nhiên từ cây mò. Nước sạch cũng giữ vai trò quan trọng vì ảnh hưởng trực tiếp đến màu sắc, độ mịn và chất lượng của giấy."
  },
  {
    id: "dac_tinh",
    title: "Đặc tính của giấy dó",
    content: "Giấy dó có trọng lượng nhẹ nhưng độ dai và độ bền cao. Bề mặt giấy thấm hút tốt, thích hợp với mực tàu, màu tự nhiên và kỹ thuật in thủ công. Khi được bảo quản đúng điều kiện, giấy có thể tồn tại lâu dài mà không bị giòn hoặc phân hủy nhanh như nhiều loại giấy sản xuất công nghiệp."
  },
  {
    id: "cong_dung",
    title: "Công dụng truyền thống",
    content: "Trong lịch sử, giấy dó được dùng để chép kinh sách, viết văn thư, làm sắc phong, lưu giữ tài liệu, sáng tác thư pháp và làm sách thủ công. Giấy còn là chất liệu quan trọng của nhiều dòng tranh dân gian và các sản phẩm phục vụ nghi lễ, giáo dục và đời sống tinh thần."
  },
  {
    id: "lang_nghe_yen_thai",
    title: "Làng giấy dó Yên Thái",
    content: "Yên Thái thuộc vùng Kẻ Bưởi xưa, gần Hồ Tây, Hà Nội. Nơi đây từng là một trong những làng làm giấy dó nổi tiếng của kinh thành Thăng Long. Tiếng chày giã dó từng vang lên thường xuyên và trở thành hình ảnh quen thuộc trong ký ức văn hóa của vùng đất này. Khi giấy công nghiệp phát triển, nghề làm giấy thủ công tại Yên Thái dần suy giảm, nhưng giá trị lịch sử của làng nghề vẫn được lưu giữ và giới thiệu trong nhiều hoạt động văn hóa."
  },
  {
    id: "nghe_thuat",
    title: "Giấy dó trong nghệ thuật",
    content: "Giấy dó gắn liền với tranh dân gian Đông Hồ, tranh Hàng Trống, thư pháp và nghệ thuật làm sách. Ngày nay, nhiều nghệ sĩ tiếp tục sử dụng giấy dó trong hội họa, nghệ thuật sắp đặt, thiết kế, đồ họa và các tác phẩm đương đại. Bề mặt xơ tự nhiên của giấy tạo nên vẻ đẹp mộc mạc và khác biệt cho mỗi tác phẩm."
  },
  {
    id: "bao_ton",
    title: "Bảo tồn nghề làm giấy",
    content: "Bảo tồn nghề làm giấy dó không chỉ là duy trì một kỹ thuật sản xuất, mà còn là gìn giữ tri thức thủ công, ký ức cộng đồng và bản sắc văn hóa Việt Nam. Các hoạt động trải nghiệm, giáo dục, trưng bày và sáng tạo sản phẩm mới có thể giúp nghề truyền thống tiếp cận gần hơn với công chúng hiện đại."
  }
];

// Contextual responses by exhibit category (PAPER PRODUCT, TOOL, ARTWORK)
export const CONTEXTUAL_RESPONSES = {
  "PAPER_PRODUCT": {
    purpose: "Trưng bày và giới thiệu các sản phẩm thủ công, mỹ thuật và ứng dụng đa dạng làm từ giấy dó trong đời sống và nghệ thuật đương đại.",
    production: "Các sản phẩm được làm thủ công bằng cách bọc, dán, khâu, vẽ hoặc bồi nhiều lớp giấy dó lên phôi/khung gỗ, tre.",
    interesting_point: "Sự đa dạng của các dòng sản phẩm từ truyền thống như quạt, mặt nạ đến các ứng dụng hiện đại như sổ tay, bao bì quà tặng tinh xảo.",
    relation_to_do_paper: "Thể hiện khả năng ứng dụng thực tế cực kỳ phong phú và sức sống bền bỉ của chất liệu giấy dó trong đời sống hiện đại."
  },
  "PAPER PRODUCT": {
    purpose: "Hiện vật này cho thấy giấy dó có thể được sử dụng trong đời sống, giáo dục, nghệ thuật hoặc lưu giữ thông tin. Công dụng cụ thể phụ thuộc vào hình thức và nội dung được thể hiện trên sản phẩm.",
    production: "Sản phẩm được tạo từ giấy dó thủ công. Sau khi giấy được xeo, ép và phơi khô, người nghệ nhân tiếp tục cắt, gấp, đóng, viết, vẽ hoặc in để tạo thành hình thức hoàn chỉnh.",
    interesting_point: "Điểm đặc biệt nằm ở bề mặt xơ tự nhiên, mép giấy thủ công và sự khác biệt nhẹ giữa từng tờ. Những đặc điểm này khiến mỗi sản phẩm có vẻ đẹp riêng.",
    relation_to_do_paper: "Giấy dó là vật liệu chính tạo nên hiện vật. Độ dai, khả năng thấm hút và bề mặt tự nhiên của giấy ảnh hưởng trực tiếp đến hình thức cũng như giá trị thẩm mỹ của sản phẩm."
  },
  "TOOL": {
    purpose: "Dụng cụ này được sử dụng trong một hoặc nhiều công đoạn làm giấy dó, giúp người thợ xử lý nguyên liệu, tạo bột giấy, xeo giấy, ép nước hoặc hoàn thiện sản phẩm.",
    production: "Dụng cụ thường được làm từ gỗ, tre, đá hoặc vật liệu bền có sẵn tại địa phương. Hình dáng của nó được thiết kế phù hợp với thao tác thủ công lặp lại trong quá trình sản xuất.",
    interesting_point: "Điểm đáng chú ý là cấu tạo đơn giản nhưng phụ thuộc nhiều vào kinh nghiệm của người thợ. Chất lượng giấy không chỉ đến từ nguyên liệu mà còn đến từ cách sử dụng dụng cụ.",
    relation_to_do_paper: "Dụng cụ này là một phần của quy trình biến vỏ cây dó thành những tờ giấy hoàn chỉnh."
  },
  "ARTWORK": {
    purpose: "Tác phẩm sử dụng giấy dó như một bề mặt để vẽ, in, viết hoặc thể hiện ý tưởng nghệ thuật.",
    production: "Nghệ nhân hoặc nghệ sĩ xử lý giấy dó bằng mực, màu tự nhiên, kỹ thuật in hoặc phương pháp tạo hình thủ công.",
    interesting_point: "Bề mặt xơ và khả năng thấm màu của giấy tạo nên sắc độ mềm, tự nhiên và khó lặp lại hoàn toàn.",
    relation_to_do_paper: "Đặc tính của giấy dó góp phần trực tiếp vào hiệu quả thị giác, cảm giác thủ công và giá trị văn hóa của tác phẩm."
  }
};

// Information database for all exhibits in the museum corridor
export const EXHIBITS_DATABASE = {
  // Existing exhibits
  "exhibit_plaque": {
    id: "exhibit_plaque",
    name: "Bia đá Lịch sử Giấy Dó",
    category: "ARTWORK",
    summary: "Bia đá Freestanding giới thiệu về nguồn gốc và giá trị văn hóa lâu đời của chất liệu giấy dó truyền thống.",
    facts: [
      "Nguyên liệu: Xơ từ vỏ cây dó và một số loài cây có đặc tính tương tự",
      "Đặc tính chính: Nhẹ, dai, bền, thấm hút tốt và có bề mặt thủ công tự nhiên",
      "Công dụng truyền thống: Thư pháp, tranh dân gian, sách, kinh văn, văn bản nghi lễ và tài liệu lưu trữ",
      "Giá trị văn hóa: Biểu tượng của nghề thủ công, nghệ thuật và di sản truyền thống Việt Nam"
    ]
  },
  "exhibit_village": {
    id: "exhibit_village",
    name: "Tranh Làng cổ Yên Thái",
    category: "ARTWORK",
    summary: "Bức tranh tái hiện nhịp sống và thanh âm tiếng chày giã dó vang dội một thời của làng nghề Yên Thái bên Hồ Tây.",
    facts: [
      "Địa điểm: Vùng Kẻ Bưởi xưa, khu vực Hồ Tây, Hà Nội",
      "Tuổi đời: Hơn 800 năm lịch sử",
      "Nguyên liệu chính: Vỏ cây dó",
      "Công dụng truyền thống: Làm giấy sắc phong, chép sử sách cổ",
      "Giá trị: Ký ức văn hóa Thăng Long - Hà Nội"
    ]
  },
  // Right-side new exhibits
  "exhibit_raw_material": {
    id: "exhibit_raw_material",
    name: "Nguyên liệu thô",
    category: "TOOL",
    summary: "Trưng bày các trạng thái của cây Dó từ vỏ cây khô thô ráp cho đến phần xơ mịn đã qua làm sạch và bột giấy sẵn sàng để xeo.",
    facts: [
      "Vỏ cây dó khô: Nguyên liệu thô ban đầu sau khi bóc từ thân cây",
      "Vỏ dó đã ngâm: Vỏ được ngâm nước để làm mềm trước khi nấu",
      "Xơ dó làm sạch: Phần xơ trắng mịn đã loại bỏ lớp vỏ đen bên ngoài",
      "Bột giấy đã giã nhuyễn: Sẵn sàng hòa tan vào bể xeo giấy"
    ]
  },
  "exhibit_tools": {
    id: "exhibit_tools",
    name: "Dụng cụ làm giấy",
    category: "TOOL",
    summary: "Bộ sưu tập các công cụ thiết yếu mà người thợ giấy dùng hàng ngày: chối giã đá, khuôn tre, mành và liềm xeo giấy.",
    facts: [
      "Chày và cối đá: Dùng để giã xơ vỏ cây dó thành bột nhuyễn",
      "Khung xeo và mành tre: Dụng cụ định hình tấm giấy khi vớt bột",
      "Tấm ép gỗ: Dùng lực ép ép kiệt nước khỏi thớt giấy ướt",
      "Dao bóc vỏ: Dùng để rạch và lột vỏ khỏi thân cây dó tươi"
    ]
  },
  "exhibit_paper_samples": {
    id: "exhibit_paper_samples",
    name: "Bức tường mẫu giấy",
    category: "PAPER PRODUCT",
    summary: "Bức tường trưng bày các loại giấy dó khác nhau về độ dày, sắc thái màu tự nhiên và kết cấu bề mặt xơ đặc trưng.",
    facts: [
      "Giấy dó mỏng (Dó bóc): Nhẹ và mịn, thường dùng chép kinh và tài liệu cổ",
      "Giấy dó dày (Dó đôi, Dó ba): Dai và cứng hơn, thích hợp làm bìa sách hoặc tranh vẽ",
      "Giấy nhuộm màu tự nhiên: Sử dụng vỏ cây mò, lá bàng hoặc củ nâu để tạo màu sắc",
      "Vân xơ rõ rệt: Các thớ xơ thực vật hiện rõ mộc mạc trên bề mặt giấy"
    ]
  },
  "exhibit_tactile_table": {
    id: "exhibit_tactile_table",
    name: "Bàn trải nghiệm xúc giác",
    category: "PAPER PRODUCT",
    summary: "Bàn tương tác cho phép khách tham quan chạm nhẹ trực tiếp lên bề mặt giấy dó để cảm nhận độ xốp, độ dai và độ ráp tự nhiên của xơ dó.",
    facts: [
      "Trải nghiệm xúc giác: Cảm nhận độ mịn và xốp đặc trưng khác biệt với giấy công nghiệp",
      "Mép giấy tự nhiên: Các mép giấy không cắt phẳng mà giữ nguyên rìa xơ mộc mạc",
      "Thử nghiệm độ dai: Cảm nhận thớ sợi liên kết đa chiều cực bền khi kéo nhẹ"
    ]
  },
  "exhibit_timeline": {
    id: "exhibit_timeline",
    name: "Dòng thời gian hành trình giấy Dó",
    category: "ARTWORK",
    summary: "Dòng lịch sử ghi nhận sự hình thành của nghề làm giấy dó từ thế kỷ XII, đỉnh cao Thăng Long, cho đến sự bảo tồn phục hưng đương đại.",
    facts: [
      "Thế kỷ XII (Thời Lý - Trần): Khởi nguồn nghề làm giấy dó thủ công tại Việt Nam",
      "Thế kỷ XV - XIX: Sự phát triển rực rỡ tại các làng nghề cổ như Yên Thái, Đông Hồ",
      "Thế kỷ XX: Sự ra đời của giấy công nghiệp hiện đại khiến làng nghề suy giảm",
      "Thế kỷ XXI: Phục hưng thông qua hội họa nghệ thuật đương đại và trải nghiệm di sản"
    ]
  },
  "exhibit_final_stele": {
    id: "exhibit_final_stele",
    name: "Bia đá Gìn giữ Di sản sống",
    category: "ARTWORK",
    summary: "Lời nhắn gửi kết luận hành trình tham quan, tôn vinh mối liên kết giữa con người, tự nhiên và giá trị văn hóa lưu truyền.",
    facts: [
      "Di sản sống: Nghề thủ công được gìn giữ qua đôi tay người thợ nối tiếp thế hệ",
      "Tính bản địa: Sử dụng nguồn nguyên liệu tự nhiên của núi rừng Việt Nam",
      "Sự tiếp nối: Nghệ thuật đương đại thổi luồng sinh khí mới vào chất liệu truyền thống"
    ]
  },
  "exhibit_products": {
    id: "product_showing_02",
    name: "Sản phẩm từ giấy dó",
    category: "PAPER_PRODUCT",
    summary: "Gian trưng bày các sản phẩm thủ công, nghệ thuật và ứng dụng được tạo từ giấy dó.",
    facts: [
      "Đặc tính nổi bật: Nhẹ, dai, bền, thấm hút tốt và có bề mặt xơ tự nhiên",
      "Kỹ thuật tạo hình: Cắt, gấp, dán, khâu, in, vẽ và bồi nhiều lớp",
      "Sản phẩm phổ biến: Sách, sổ, tranh, mặt nạ, thiệp, quạt, đèn, hộp và quà lưu niệm",
      "Vật liệu kết hợp: Tre, gỗ, vải, sợi tự nhiên và màu thủ công",
      "Giá trị: Kết nối nghề thủ công truyền thống với thiết kế và đời sống hiện đại"
    ],
    title: "SẢN PHẨM TỪ GIẤY DÓ",
    subtitle: "Từ chất liệu truyền thống đến những sản phẩm trong đời sống hiện đại",
    overview: "Giấy dó không chỉ được sử dụng để viết, vẽ và lưu giữ tài liệu mà còn có thể được tạo thành nhiều sản phẩm thủ công, trang trí và ứng dụng trong đời sống. Nhờ đặc tính nhẹ, dai, bền, thấm hút tốt và có bề mặt xơ tự nhiên, giấy dó mang đến vẻ đẹp mộc mạc, tinh tế và khác biệt cho mỗi sản phẩm.\n\nTừ những tờ giấy được xeo hoàn toàn bằng tay, nghệ nhân có thể cắt, gấp, dán, khâu, in, vẽ, bồi nhiều lớp hoặc kết hợp với gỗ, tre, vải và các vật liệu tự nhiên khác để tạo thành những sản phẩm hoàn chỉnh.",
    conclusion: "Mỗi sản phẩm từ giấy dó đều lưu giữ dấu vết của quá trình làm giấy thủ công và bàn tay của người nghệ nhân. Việc sử dụng giấy dó trong các sản phẩm mới không chỉ tạo ra giá trị thẩm mỹ mà còn góp phần duy trì, quảng bá và phát triển một chất liệu văn hóa truyền thống của Việt Nam.",
    product_categories: [
      {
        title: "Sách và sổ tay",
        content: "Giấy dó có thể được sử dụng để làm sách thủ công, sổ ghi chép, sổ ký họa, album ảnh và các ấn phẩm phiên bản giới hạn. Bề mặt giấy tạo cảm giác tự nhiên, phù hợp với viết tay, thư pháp, vẽ mực và màu nước. Phần bìa có thể được trang trí bằng kỹ thuật in, vẽ, ép hoa hoặc khâu thủ công."
      },
      {
        title: "Mặt nạ giấy",
        content: "Mặt nạ có thể được tạo bằng cách bồi nhiều lớp giấy dó lên khuôn. Sau khi khô, sản phẩm được tháo khỏi khuôn, chỉnh sửa bề mặt và trang trí bằng màu vẽ. Giấy dó giúp mặt nạ nhẹ nhưng vẫn có độ dai và độ cứng cần thiết. Mặt nạ có thể được sử dụng trong trưng bày, biểu diễn, giáo dục hoặc trang trí."
      },
      {
        title: "Tranh và tác phẩm nghệ thuật",
        content: "Giấy dó là chất liệu phù hợp với tranh dân gian, thư pháp, tranh mực, tranh màu nước, in khắc và nghệ thuật đương đại. Khả năng thấm màu cùng bề mặt xơ tự nhiên tạo nên những sắc độ mềm mại và hiệu ứng khó lặp lại hoàn toàn."
      },
      {
        title: "Thiệp và bưu thiếp",
        content: "Giấy dó có thể được làm thành thiệp chúc mừng, thiệp mời, bưu thiếp, thẻ đánh dấu sách và thẻ quà tặng. Những sản phẩm này thường được trang trí bằng thư pháp, hình in thủ công, hoa lá ép hoặc họa tiết văn hóa Việt Nam."
      },
      {
        title: "Quạt và đồ trang trí",
        content: "Giấy dó có thể được bồi lên khung tre hoặc khung gỗ để làm quạt, đèn trang trí, tranh treo, đồ gấp giấy và các vật phẩm trang trí nội thất. Khi có ánh sáng chiếu qua, phần xơ giấy tạo nên hiệu ứng ấm áp và mềm mại."
      },
      {
        title: "Hộp và bao bì thủ công",
        content: "Giấy dó có thể được dùng để bọc hộp, làm túi quà, bao bì sản phẩm thủ công hoặc lớp trang trí bên ngoài. Chất liệu này giúp sản phẩm có vẻ ngoài tự nhiên, thân thiện và mang đậm dấu ấn thủ công."
      },
      {
        title: "Đồ dùng văn phòng và quà lưu niệm",
        content: "Các sản phẩm có thể bao gồm lịch để bàn, bìa hồ sơ, phong bì, giấy viết thư, khung ảnh, móc trang trí và bộ quà tặng. Đây là cách đưa chất liệu truyền thống vào đời sống hiện đại và giới thiệu văn hóa giấy dó tới nhiều người hơn."
      },
      {
        title: "Sản phẩm sáng tạo đương đại",
        content: "Ngày nay, nghệ sĩ và nhà thiết kế còn sử dụng giấy dó trong nghệ thuật sắp đặt, thiết kế thời trang, mô hình, điêu khắc giấy, đèn nghệ thuật và các sản phẩm thiết kế thử nghiệm. Những ứng dụng mới giúp giấy dó tiếp tục tồn tại trong đời sống đương đại."
      }
    ]
  }
};
