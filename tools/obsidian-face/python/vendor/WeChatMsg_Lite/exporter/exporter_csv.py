import csv
import os
from pathlib import Path

from wxManager import Message
from wxManager.model import Me
from exporter.exporter import ExporterBase
# from exporter.exporter import get_new_filename
import traceback

class CSVExporter(ExporterBase):
    def message_to_list(self, message: Message):
        # 是否把空白字段统一填成微信昵称
        # False：没有备注/群昵称就留空
        # True：没有备注/群昵称就填 nickname
        fill_empty_with_nickname = False

        def fill_name(value, nickname):
            value = value or ""
            nickname = nickname or ""
            if fill_empty_with_nickname:
                return value or nickname
            return value

        # 1. 判断发送人 wxid 和联系人对象
        if self.contact.is_chatroom():
            sender_wxid = message.sender_id

            contact = self.group_contacts.get(sender_wxid)
            if contact is None:
                contact = self.database.get_contact_by_username(sender_wxid)
                self.group_contacts[sender_wxid] = contact
        else:
            if message.is_sender:
                sender_wxid = Me().wxid
                contact = Me()
            else:
                sender_wxid = self.contact.wxid
                contact = self.contact

        # 2. 分别取字段
        nickname = getattr(contact, "nickname", "") or ""
        remark = getattr(contact, "contact_remark", "") or ""
        group_nickname = getattr(contact, "group_nickname", "") or ""

        # 3. 空白处理
        remark = fill_name(remark, nickname)
        group_nickname = fill_name(group_nickname, nickname)

        res = [
            str(message.server_id),
            message.type_name(),
            sender_wxid,
            message.str_time,
            message.to_text(),
            remark,
            group_nickname,
            nickname
        ]
        return res

    def export(self):
        print(f"开始导出 CSV: {self.contact.remark}")
        os.makedirs(self.origin_path, exist_ok=True)

        filename = os.path.join(self.origin_path,f"{self.contact.remark}.csv")
        # filename = get_new_filename(filename)
        self.csv_path = str(Path(filename).resolve())

        # print("[CSV DEBUG] origin_path =", self.origin_path)
        # print("[CSV DEBUG] filename =", filename)
        # print("[CSV DEBUG] contact.wxid =", self.contact.wxid)
        # print("[CSV DEBUG] time_range =", self.time_range)

        columns = ['消息ID', '类型', 'wxid', '时间', '内容', '备注', '群昵称', '昵称']

        # print("[CSV DEBUG] before get_chatroom_members")
        # print("[CSV DEBUG] contact.wxid =", self.contact.wxid)
        # print("[CSV DEBUG] contact.remark =", self.contact.remark)
        # print("[CSV DEBUG] is_chatroom =", self.contact.is_chatroom())
        # print("[CSV DEBUG] time_range =", self.time_range)

        try:
            if self.contact.is_chatroom():
                self.group_contacts = self.database.get_chatroom_members(self.contact.wxid)
                # print("[CSV DEBUG] after get_chatroom_members")
                # print("[CSV DEBUG] group_contacts count =", len(self.group_contacts))

                self.group_contacts[Me().wxid] = Me()
            else:
                self.group_contacts = {
                    Me().wxid: Me(),
                    self.contact.wxid: self.contact
                }
                print("[CSV DEBUG] non-chatroom group_contacts ready")

        except Exception as e:
            print("[CSV ERROR] get_chatroom_members failed:", repr(e))
            traceback.print_exc()
            raise

        # print("[CSV DEBUG] before get_messages")

        try:
            messages = self.database.get_messages(
                self.contact.wxid,
                time_range=self.time_range
            )

            # print("[CSV DEBUG] after get_messages")
            # print("[CSV DEBUG] messages type =", type(messages))
            # print("[CSV DEBUG] messages count =", len(messages))

            total_steps = len(messages)

        except Exception as e:
            print("[CSV ERROR] get_messages failed:", repr(e))
            traceback.print_exc()
            raise

        # 写入CSV文件
        try:
            with open(filename, mode='w', newline='', encoding='utf-8-sig') as file:
                writer = csv.writer(file)
                writer.writerow(columns)

                csv_res = []
                for index, message in enumerate(messages):
                    if index and index % 1000 == 0:
                        self.update_progress_callback(index / total_steps)

                    if not self.is_selected(message):
                        continue

                    csv_res.append(self.message_to_list(message))

                writer.writerows(csv_res)

        except PermissionError:
            raise PermissionError(
                f"无法覆盖 CSV 文件：{filename}。"
                f"请先关闭 Excel/WPS 中打开的该文件，然后重新导出。"
            )

        self.update_progress_callback(1)
        self.finish_callback(self.exporter_id)
        print(f"完成导出 CSV :{self.contact.remark}")
